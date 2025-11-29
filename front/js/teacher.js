const BASE_URL = "https://unwillingly-tonic-cougar.cloudpub.ru"; // поправь под свой бэк
const LOGIN_PAGE = "/front/templates/index.html";

// Глобальные переменные
let currentUser = null;
let coursesList = [];
let themesByCourse = {};      // { courseId:number: Theme[] }
let studentsList = [];        // все уникальные студенты
let studentsByCourse = {};    // { courseId:number: Student[] }
let currentCourseId = null;
let currentCourse = null;
let currentThemeId = null;
let currentTheme = null;

// для модалки ДЗ
let currentHomeworkId = null;
let lastLoadedHomeworks = []; // кеш списка ДЗ, чтобы в модалке было, что показать

// Утилита запросов
async function apiFetch(path, options = {}) {
    const res = await fetch(BASE_URL + path, {
        credentials: "include",
        ...options
    });

    let data = null;
    try {
        data = await res.json();
    } catch (_) {
        // может быть пустой ответ
    }

    if (!res.ok) {
        const msg = data && data.detail ? data.detail : `Ошибка ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

document.addEventListener("DOMContentLoaded", () => {
    init();
});

async function init() {
    // Шапка
    const elUserName = document.getElementById("user-name");
    const elUserRole = document.getElementById("user-role");
    const elLogoutBtn = document.getElementById("logout-btn");
    const elGlobalMsg = document.getElementById("global-message");

    // Вкладки
    const tabButtons = document.querySelectorAll(".tab-btn");
    const pages = {
        students: document.getElementById("page-students"),
        courses: document.getElementById("page-courses")
    };

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const pageKey = btn.dataset.page;
            if (!pageKey) return;

            tabButtons.forEach(b => b.classList.remove("PageActive"));
            btn.classList.add("PageActive");

            Object.values(pages).forEach(p => p.classList.remove("PageActive"));
            pages[pageKey].classList.add("PageActive");
        });
    });

    // Блок "Мои ученики / Домашки"
    const elStudentsTableBody = document.querySelector("#students-table tbody");
    const elStudentsMsg = document.getElementById("students-message");

    const elFilterCourse = document.getElementById("filter-course");
    const elFilterTheme = document.getElementById("filter-theme");
    const elFilterStatus = document.getElementById("filter-status");
    const elFilterStudent = document.getElementById("filter-student");
    const elBtnApplyFilters = document.getElementById("btn-apply-filters");
    const elHomeworksTableBody = document.querySelector("#homeworks-table tbody");
    const elHomeworksMsg = document.getElementById("homeworks-message");

    // Блок "Мои курсы и темы"
    const elBtnAddCourse = document.getElementById("btn-add-course");
    const elCoursesList = document.getElementById("courses-list");
    const elThemesList = document.getElementById("themes-list");
    const elThemesMsg = document.getElementById("themes-message");

    // Редактор курса
    const elCourseName = document.getElementById("course-name");
    const elCourseDesc = document.getElementById("course-description");
    const elBtnSaveCourse = document.getElementById("btn-save-course");
    const elBtnDeleteCourse = document.getElementById("btn-delete-course");
    const elCourseFormMsg = document.getElementById("course-form-message");

    // Редактор темы
    const elThemeName = document.getElementById("theme-name");
    const elThemeText = document.getElementById("theme-text");
    const elThemeIsHomework = document.getElementById("theme-is-homework");
    const elThemeFiles = document.getElementById("theme-files");
    const elThemeFilesList = document.getElementById("theme-files-list");
    const elBtnSaveTheme = document.getElementById("btn-save-theme");
    const elBtnClearTheme = document.getElementById("btn-clear-theme");
    const elBtnDeleteTheme = document.getElementById("btn-delete-theme");
    const elThemeFormMsg = document.getElementById("theme-form-message");

    // Модалка ДЗ
    const elHwModal = document.getElementById("homework-modal");
    const elHwModalTitle = document.getElementById("modal-hw-title");
    const elHwModalStudent = document.getElementById("modal-hw-student");
    const elHwModalStatus = document.getElementById("modal-hw-status");
    const elHwModalText = document.getElementById("modal-hw-text");
    const elHwModalScore = document.getElementById("modal-hw-score");
    const elHwModalScoreValue = document.getElementById("modal-hw-score-value");
    const elHwModalComment = document.getElementById("modal-hw-comment");
    const elHwModalMsg = document.getElementById("modal-hw-message");
    const elHwModalSaveBtn = document.getElementById("modal-hw-save");
    const elHwModalCancelBtn = document.getElementById("modal-hw-cancel");
    const elHwModalCloseBtn = document.getElementById("modal-hw-close");

    function openHomeworkModal(hw) {
        if (!hw) return;
        currentHomeworkId = hw.id;

        const student = studentsList.find(s => s.id === hw.student_id);

        elHwModalTitle.textContent = hw.title || "Домашнее задание";

        elHwModalStudent.textContent = student
            ? (student.full_name || student.email || `ID ${student.id}`)
            : (hw.student_id ? `ID ${hw.student_id}` : "—");

        elHwModalStatus.innerHTML = "";
        const statusSpan = document.createElement("span");
        statusSpan.className = "pill-status";
        const status = hw.status || "pending";
        if (status === "graded") {
            statusSpan.textContent = "Проверено";
            statusSpan.classList.add("pill-status-success");
        } else if (status === "pending") {
            statusSpan.textContent = "На проверке";
            statusSpan.classList.add("pill-status-pending");
        } else {
            statusSpan.textContent = status;
        }
        elHwModalStatus.appendChild(statusSpan);

        elHwModalText.textContent = hw.text || "Текст ответа не указан.";

        let initialScore = 0;
        let initialComment = "";

        if (typeof hw.score === "number") {
            initialScore = hw.score;
        } else if (hw.submission && typeof hw.submission.score === "number") {
            initialScore = hw.submission.score;
        }

        if (typeof hw.teacher_comment === "string") {
            initialComment = hw.teacher_comment;
        } else if (hw.submission && typeof hw.submission.teacher_comment === "string") {
            initialComment = hw.submission.teacher_comment;
        }

        if (!initialScore || initialScore < 1 || initialScore > 10) {
            initialScore = 10;
        }

        elHwModalScore.value = String(initialScore);
        elHwModalScoreValue.textContent = `${initialScore}/10`;

        elHwModalComment.value = initialComment || "";

        elHwModalMsg.textContent = "";
        elHwModalMsg.className = "message-box";

        elHwModal.classList.add("open");
    }

    function closeHomeworkModal() {
        currentHomeworkId = null;
        elHwModal.classList.remove("open");
    }

    elHwModalScore.addEventListener("input", () => {
        const val = Number(elHwModalScore.value || 0);
        if (val) {
            elHwModalScoreValue.textContent = `${val}/10`;
        } else {
            elHwModalScoreValue.textContent = "—";
        }
    });

    elHwModalSaveBtn.addEventListener("click", async () => {
        if (!currentHomeworkId) return;

        const score = Number(elHwModalScore.value || 0);
        const teacher_comment = elHwModalComment.value.trim();

        elHwModalMsg.textContent = "";
        elHwModalMsg.className = "message-box";

        if (!score || score < 1 || score > 10) {
            elHwModalMsg.textContent = "Оценка должна быть от 1 до 10.";
            elHwModalMsg.className = "message-box message-error";
            return;
        }

        try {
            await apiFetch(`/homeworks/${currentHomeworkId}/grade`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score, teacher_comment })
            });

            elHwModalMsg.textContent = "Оценка сохранена.";
            elHwModalMsg.className = "message-box message-success";

            await loadHomeworks();
        } catch (e) {
            elHwModalMsg.textContent = "Ошибка при сохранении оценки: " + e.message;
            elHwModalMsg.className = "message-box message-error";
        }
    });

    elHwModalCancelBtn.addEventListener("click", closeHomeworkModal);
    elHwModalCloseBtn.addEventListener("click", closeHomeworkModal);
    elHwModal.addEventListener("click", (e) => {
        if (e.target === elHwModal) {
            closeHomeworkModal();
        }
    });

    // Логаут
    elLogoutBtn.addEventListener("click", async () => {
        try {
            await apiFetch("/logout", { method: "POST" });
        } catch (_) {}
        window.location.href = LOGIN_PAGE;
    });

    // Фильтр "Курс" (иерархия)
    elFilterCourse.addEventListener("change", () => {
        handleCourseFilterChange();
    });

    // Применить фильтры
    elBtnApplyFilters.addEventListener("click", () => {
        loadHomeworks();
    });

    // "Создать курс"
    elBtnAddCourse.addEventListener("click", () => {
        currentCourseId = null;
        currentCourse = null;
        clearCourseForm();
        clearThemeForm(true);
        elCourseFormMsg.textContent = "Создание нового курса. Заполните поля и нажмите «Сохранить курс».";
        elCourseFormMsg.className = "message-box";
        document.querySelectorAll(".course-item").forEach(el => el.classList.remove("active"));
    });

    // Сохранить курс
    elBtnSaveCourse.addEventListener("click", async () => {
        const name = elCourseName.value.trim();
        const description = elCourseDesc.value.trim();

        elCourseFormMsg.textContent = "";
        elCourseFormMsg.className = "message-box";

        if (!name) {
            elCourseFormMsg.textContent = "Введите название курса.";
            elCourseFormMsg.className = "message-box message-error";
            return;
        }

        try {
            let saved;
            if (currentCourseId) {
                saved = await apiFetch(`/courses/${currentCourseId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, description })
                });
                elCourseFormMsg.textContent = "Курс обновлён.";
            } else {
                saved = await apiFetch("/courses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, description })
                });
                elCourseFormMsg.textContent = "Курс создан.";
            }
            elCourseFormMsg.className = "message-box message-success";

            await loadCourses();
            await loadStudents();

            if (saved && saved.id) {
                currentCourseId = saved.id;
                await onCourseClick(saved.id);
            }
        } catch (e) {
            elCourseFormMsg.textContent = "Ошибка при сохранении курса: " + e.message;
            elCourseFormMsg.className = "message-box message-error";
        }
    });

    // Удалить курс
    elBtnDeleteCourse.addEventListener("click", async () => {
        if (!currentCourseId) {
            elCourseFormMsg.textContent = "Курс не выбран.";
            elCourseFormMsg.className = "message-box message-error";
            return;
        }

        const ok = confirm("Удалить курс полностью?");
        if (!ok) return;

        elCourseFormMsg.textContent = "";
        elCourseFormMsg.className = "message-box";

        try {
            await apiFetch(`/courses/${currentCourseId}`, { method: "DELETE" });
            elCourseFormMsg.textContent = "Курс удалён.";
            elCourseFormMsg.className = "message-box message-success";

            currentCourseId = null;
            currentCourse = null;
            clearCourseForm();
            clearThemeForm(true);

            await loadCourses();
            await loadStudents();
            await loadHomeworks();

            elFilterCourse.value = "";
            await handleCourseFilterChange();
        } catch (e) {
            elCourseFormMsg.textContent = "Ошибка при удалении курса: " + e.message;
            elCourseFormMsg.className = "message-box message-error";
        }
    });

    // Сохранить тему
    elBtnSaveTheme.addEventListener("click", async () => {
        if (!currentCourseId) {
            elThemeFormMsg.textContent = "Сначала выберите курс.";
            elThemeFormMsg.className = "message-box message-error";
            return;
        }

        const name = elThemeName.value.trim();
        const text = elThemeText.value.trim();
        const is_homework = !!elThemeIsHomework.checked;

        if (!name) {
            elThemeFormMsg.textContent = "Введите название темы.";
            elThemeFormMsg.className = "message-box message-error";
            return;
        }

        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";

        try {
            let savedTheme;

            if (currentThemeId) {
                savedTheme = await apiFetch(`/themes/theme/${currentThemeId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, text, is_homework })
                });
                elThemeFormMsg.textContent = "Тема обновлена.";
            } else {
                savedTheme = await apiFetch(`/themes/${currentCourseId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, text, is_homework })
                });
                elThemeFormMsg.textContent = "Тема создана.";
            }

            elThemeFormMsg.className = "message-box message-success";

            if (savedTheme && savedTheme.id) {
                // загружаем файлы, если выбраны
                await uploadThemeFiles(savedTheme.id, elThemeFiles, elThemeFormMsg);
                await loadThemeFiles(savedTheme.id, elThemeFilesList);
                elThemeFiles.value = "";
            }

            await loadThemes(currentCourseId);
            await rebuildThemeFilter(getSelectedCourseIdFromFilter());
            await loadHomeworks();

            if (savedTheme && savedTheme.id) {
                onThemeClick(savedTheme.id, currentCourseId);
            }
        } catch (e) {
            elThemeFormMsg.textContent = "Ошибка при сохранении темы: " + e.message;
            elThemeFormMsg.className = "message-box message-error";
        }
    });

    // Очистить форму темы
    elBtnClearTheme.addEventListener("click", () => {
        clearThemeForm(true);
    });

    // Удалить тему
    elBtnDeleteTheme.addEventListener("click", async () => {
        if (!currentThemeId) {
            elThemeFormMsg.textContent = "Тема не выбрана.";
            elThemeFormMsg.className = "message-box message-error";
            return;
        }

        const ok = confirm("Удалить тему?");
        if (!ok) return;

        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";

        try {
            await apiFetch(`/themes/theme/${currentThemeId}`, { method: "DELETE" });
            elThemeFormMsg.textContent = "Тема удалена.";
            elThemeFormMsg.className = "message-box message-success";

            currentThemeId = null;
            currentTheme = null;
            clearThemeForm(true);

            await loadThemes(currentCourseId);
            await rebuildThemeFilter(getSelectedCourseIdFromFilter());
            await loadHomeworks();
        } catch (e) {
            elThemeFormMsg.textContent = "Ошибка при удалении темы: " + e.message;
            elThemeFormMsg.className = "message-box message-error";
        }
    });

    // ============ Основная инициализация ============

    try {
        elGlobalMsg.textContent = "Загрузка профиля...";
        currentUser = await apiFetch("/auth/me");

        elUserName.textContent = currentUser.full_name || currentUser.email || "Пользователь";
        elUserRole.textContent = currentUser.is_teacher ? "Преподаватель" : "Студент";

        if (!currentUser.is_teacher) {
            elGlobalMsg.textContent = "Этот кабинет доступен только преподавателям.";
            return;
        }

        elGlobalMsg.textContent = "";

        await loadCourses();
        await loadStudents();
        await loadHomeworks();
        await handleCourseFilterChange();
    } catch (e) {
        elGlobalMsg.textContent = "Ошибка: " + e.message;
    }

    // ============ ЛОГИКА ЗАГРУЗКИ ДАННЫХ ============

    async function loadCourses() {
        const elCoursesList = document.getElementById("courses-list");

        elCoursesList.innerHTML = "";
        elThemesList.innerHTML = "";
        elThemesMsg.textContent = "";
        elFilterCourse.innerHTML = '<option value="">Курс: все</option>';
        elFilterTheme.innerHTML = '<option value="">Тема: все</option>';
        themesByCourse = {};

        try {
            coursesList = await apiFetch("/courses/my");

            if (!Array.isArray(coursesList) || coursesList.length === 0) {
                elCoursesList.innerHTML = '<span class="muted-text">У вас пока нет курсов.</span>';
                return;
            }

            coursesList.forEach(course => {
                const item = document.createElement("div");
                item.className = "course-item";
                item.dataset.courseId = course.id;

                const title = document.createElement("div");
                title.className = "course-item-title";
                title.textContent = course.name || ("Курс #" + course.id);

                const meta = document.createElement("div");
                meta.className = "course-item-meta";
                meta.textContent = course.description || "";

                item.appendChild(title);
                item.appendChild(meta);
                elCoursesList.appendChild(item);

                item.addEventListener("click", () => {
                    onCourseClick(course.id);
                });

                const opt = document.createElement("option");
                opt.value = course.id;
                opt.textContent = course.name || ("Курс #" + course.id);
                elFilterCourse.appendChild(opt);
            });

            if (currentCourseId) {
                document.querySelectorAll(".course-item").forEach(el => {
                    el.classList.toggle("active", Number(el.dataset.courseId) === Number(currentCourseId));
                });
            }
        } catch (e) {
            elThemesMsg.textContent = "Ошибка загрузки курсов: " + e.message;
            elThemesMsg.className = "message-box message-error";
        }
    }

    async function loadStudents() {
        studentsByCourse = {};
        studentsList = [];

        elStudentsMsg.textContent = "Загрузка студентов...";
        elStudentsMsg.className = "message-box";
        elStudentsTableBody.innerHTML = "";
        elFilterStudent.innerHTML = '<option value="">Студент: все</option>';

        try {
            const courses = await apiFetch("/courses/my");

            if (!Array.isArray(courses) || courses.length === 0) {
                elStudentsMsg.textContent = "У вас пока нет курсов.";
                elStudentsMsg.className = "message-box";
                return;
            }

            for (const course of courses) {
                try {
                    const courseStudents = await apiFetch(`/courses/${course.id}/students`);
                    studentsByCourse[course.id] = Array.isArray(courseStudents) ? courseStudents : [];

                    studentsByCourse[course.id].forEach(student => {
                        if (!studentsList.find(s => s.id === student.id)) {
                            studentsList.push(student);
                        }
                    });
                } catch (err) {
                    console.error(`Ошибка загрузки студентов курса ${course.id}:`, err);
                    studentsByCourse[course.id] = [];
                }
            }

            const selectedCourseId = getSelectedCourseIdFromFilter();
            renderStudentsTable(selectedCourseId);
            populateStudentFilter(selectedCourseId);

            if (studentsList.length > 0) {
                elStudentsMsg.textContent = `Загружено ${studentsList.length} студентов`;
                elStudentsMsg.className = "message-box message-success";
            } else {
                elStudentsMsg.textContent = "На ваших курсах пока нет студентов.";
                elStudentsMsg.className = "message-box";
            }
        } catch (e) {
            console.error("Ошибка загрузки студентов:", e);
            elStudentsMsg.textContent = "Ошибка загрузки студентов: " + e.message;
            elStudentsMsg.className = "message-box message-error";
        }
    }

    async function loadThemes(courseId) {
        elThemesList.innerHTML = "";
        elThemesMsg.textContent = "Загрузка тем...";
        elThemesMsg.className = "message-box";

        try {
            const themes = await apiFetch(`/themes/${courseId}`);
            themesByCourse[courseId] = themes;

            if (!Array.isArray(themes) || themes.length === 0) {
                elThemesList.innerHTML = '<span class="muted-text">Тем пока нет.</span>';
                elThemesMsg.textContent = "";
                return;
            }

            elThemesList.innerHTML = "";

            themes.forEach(theme => {
                const item = document.createElement("div");
                item.className = "theme-item";
                item.dataset.themeId = theme.id;
                item.dataset.courseId = courseId;

                const main = document.createElement("div");
                main.className = "theme-item-main";

                const title = document.createElement("div");
                title.className = "theme-item-title";
                title.textContent = theme.name || ("Тема #" + theme.id);

                main.appendChild(title);
                item.appendChild(main);
                elThemesList.appendChild(item);

                item.addEventListener("click", () => {
                    onThemeClick(theme.id, courseId);
                });
            });

            if (currentThemeId) {
                document.querySelectorAll(".theme-item").forEach(el => {
                    el.classList.toggle("active", Number(el.dataset.themeId) === Number(currentThemeId));
                });
            }

            elThemesMsg.textContent = "";
            elThemesMsg.className = "message-box";
        } catch (e) {
            elThemesMsg.textContent = "Ошибка загрузки тем: " + e.message;
            elThemesMsg.className = "message-box message-error";
        }
    }

    async function loadHomeworks() {
        elHomeworksMsg.textContent = "Загрузка домашних заданий...";
        elHomeworksMsg.className = "message-box";
        elHomeworksTableBody.innerHTML = "";

        const params = new URLSearchParams();
        if (elFilterCourse.value) params.append("course_id", elFilterCourse.value);
        if (elFilterTheme.value) params.append("theme_id", elFilterTheme.value);
        if (elFilterStatus.value) params.append("status", elFilterStatus.value);
        if (elFilterStudent.value) params.append("student_id", elFilterStudent.value);
        params.append("skip", "0");
        params.append("limit", "20");

        try {
            const homeworks = await apiFetch(`/homeworks?${params.toString()}`);
            lastLoadedHomeworks = Array.isArray(homeworks) ? homeworks : [];

            if (!Array.isArray(homeworks) || homeworks.length === 0) {
                elHomeworksMsg.textContent = "Домашних заданий не найдено.";
                elHomeworksMsg.className = "message-box";
                return;
            }

            homeworks.forEach(hw => {
                const tr = document.createElement("tr");

                const tdCourse = document.createElement("td");
                const tdTheme = document.createElement("td");
                const tdStudent = document.createElement("td");
                const tdStatus = document.createElement("td");

                tdCourse.textContent = getCourseNameForHomework(hw);
                tdTheme.textContent = getThemeNameForHomework(hw);

                const allStudents = studentsList || [];
                const student = allStudents.find(s => s.id === hw.student_id);
                tdStudent.textContent = student
                    ? (student.full_name || student.email || `ID ${student.id}`)
                    : (hw.student_id ? `ID ${hw.student_id}` : "");

                const statusSpan = document.createElement("span");
                statusSpan.className = "pill-status";
                const status = hw.status || "pending";
                if (status === "graded") {
                    statusSpan.textContent = "Проверено";
                    statusSpan.classList.add("pill-status-success");
                } else if (status === "pending") {
                    statusSpan.textContent = "На проверке";
                    statusSpan.classList.add("pill-status-pending");
                } else {
                    statusSpan.textContent = status;
                }
                tdStatus.appendChild(statusSpan);

                tr.appendChild(tdCourse);
                tr.appendChild(tdTheme);
                tr.appendChild(tdStudent);
                tr.appendChild(tdStatus);

                tr.addEventListener("click", () => {
                    openHomeworkModal(hw);
                });

                elHomeworksTableBody.appendChild(tr);
            });

            elHomeworksMsg.textContent = "";
            elHomeworksMsg.className = "message-box";
        } catch (e) {
            elHomeworksMsg.textContent = "Ошибка загрузки домашних заданий: " + e.message;
            elHomeworksMsg.className = "message-box message-error";
        }
    }

    // ============ ИЕРАРХИЧЕСКАЯ ФИЛЬТРАЦИЯ ============

    async function handleCourseFilterChange() {
        const selectedCourseId = getSelectedCourseIdFromFilter();

        renderStudentsTable(selectedCourseId);
        populateStudentFilter(selectedCourseId);
        await rebuildThemeFilter(selectedCourseId);
        await loadHomeworks();
    }

    function renderStudentsTable(courseId) {
        elStudentsTableBody.innerHTML = "";

        const list = courseId
            ? (studentsByCourse[courseId] || [])
            : studentsList;

        if (!list || list.length === 0) {
            elStudentsMsg.textContent = courseId
                ? "На этом курсе пока нет студентов."
                : "На ваших курсах пока нет студентов.";
            elStudentsMsg.className = "message-box";
            return;
        }

        list.forEach(student => {
            const tr = document.createElement("tr");

            const tdName = document.createElement("td");
            const tdEmail = document.createElement("td");

            const initials = getInitials(student.full_name || student.email || "");
            const avatar = document.createElement("span");
            avatar.className = "avatar-circle";
            avatar.textContent = initials || "?";

            tdName.appendChild(avatar);
            tdName.appendChild(document.createTextNode(student.full_name || "Без имени"));
            tdEmail.textContent = student.email || "";

            tr.appendChild(tdName);
            tr.appendChild(tdEmail);
            elStudentsTableBody.appendChild(tr);
        });

        elStudentsMsg.textContent = `Показано ${list.length} студентов`;
        elStudentsMsg.className = "message-box message-success";
    }

    function populateStudentFilter(courseId) {
        elFilterStudent.innerHTML = '<option value="">Студент: все</option>';

        const list = courseId
            ? (studentsByCourse[courseId] || [])
            : studentsList;

        if (!list || list.length === 0) return;

        list.forEach(student => {
            const opt = document.createElement("option");
            opt.value = student.id;
            opt.textContent = student.full_name || student.email || ("ID " + student.id);
            elFilterStudent.appendChild(opt);
        });
    }

    async function rebuildThemeFilter(courseId) {
        elFilterTheme.innerHTML = '<option value="">Тема: все</option>';

        if (courseId) {
            if (!themesByCourse[courseId]) {
                try {
                    const th = await apiFetch(`/themes/${courseId}`);
                    themesByCourse[courseId] = th;
                } catch (e) {
                    console.error("Ошибка загрузки тем курса:", e);
                    return;
                }
            }
            const list = themesByCourse[courseId] || [];
            list.forEach(theme => {
                const opt = document.createElement("option");
                opt.value = theme.id;
                opt.textContent = theme.name || ("Тема #" + theme.id);
                elFilterTheme.appendChild(opt);
            });
            return;
        }

        if (!coursesList || coursesList.length === 0) return;

        const promises = [];
        for (const course of coursesList) {
            if (!themesByCourse[course.id]) {
                promises.push(
                    apiFetch(`/themes/${course.id}`)
                        .then(th => { themesByCourse[course.id] = th; })
                        .catch(e => console.error(`Ошибка загрузки тем курса ${course.id}:`, e))
                );
            }
        }
        if (promises.length) {
            await Promise.all(promises);
        }

        const addedIds = new Set();
        Object.values(themesByCourse).forEach(arr => {
            (arr || []).forEach(theme => {
                if (addedIds.has(theme.id)) return;
                addedIds.add(theme.id);
                const opt = document.createElement("option");
                opt.value = theme.id;
                opt.textContent = theme.name || ("Тема #" + theme.id);
                elFilterTheme.appendChild(opt);
            });
        });
    }

    // ============ Обработчики кликов по курсу/теме ============

    async function onCourseClick(courseId) {
        currentCourseId = courseId;
        currentThemeId = null;
        currentTheme = null;

        document.querySelectorAll(".course-item").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.courseId) === Number(courseId));
        });

        currentCourse = coursesList.find(c => c.id === courseId) || null;
        if (currentCourse) {
            elCourseName.value = currentCourse.name || "";
            elCourseDesc.value = currentCourse.description || "";
        } else {
            clearCourseForm();
        }
        elCourseFormMsg.textContent = "";
        elCourseFormMsg.className = "message-box";

        elFilterCourse.value = String(courseId);

        clearThemeForm(true);

        await loadThemes(courseId);
        await handleCourseFilterChange();
    }

    async function onThemeClick(themeId, courseId) {
        currentThemeId = themeId;
        const list = themesByCourse[courseId] || [];
        currentTheme = list.find(t => t.id === themeId) || null;

        document.querySelectorAll(".theme-item").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.themeId) === Number(themeId));
        });

        if (currentTheme) {
            elThemeName.value = currentTheme.name || "";
            elThemeText.value = currentTheme.text || "";
            elThemeIsHomework.checked = !!currentTheme.is_homework;
            await loadThemeFiles(themeId, elThemeFilesList);
        } else {
            clearThemeForm(false);
        }

        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";
    }

    // ============ Вспомогательные функции ============

    function clearCourseForm() {
        elCourseName.value = "";
        elCourseDesc.value = "";
        elCourseFormMsg.textContent = "";
        elCourseFormMsg.className = "message-box";
    }

    function clearThemeForm(clearSelection) {
        elThemeName.value = "";
        elThemeText.value = "";
        elThemeIsHomework.checked = false;
        elThemeFiles.value = "";
        if (elThemeFilesList) {
            elThemeFilesList.innerHTML = "";
        }
        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";
        if (clearSelection) {
            currentThemeId = null;
            currentTheme = null;
            document.querySelectorAll(".theme-item").forEach(el => el.classList.remove("active"));
        }
    }

    function getSelectedCourseIdFromFilter() {
        const val = elFilterCourse.value;
        return val ? Number(val) : null;
    }

    function getInitials(name) {
        if (!name) return "";
        return name
            .split(" ")
            .filter(Boolean)
            .map(w => w[0].toUpperCase())
            .slice(0, 2)
            .join("");
    }

    function getCourseNameForHomework(hw) {
        if (hw.course_name) return hw.course_name;
        if (hw.course && hw.course.name) return hw.course.name;

        if (hw.course_id && Array.isArray(coursesList) && coursesList.length > 0) {
            const c = coursesList.find(c => c.id === hw.course_id);
            if (c) return c.name || `Курс #${c.id}`;
        }

        if (hw.theme && hw.theme.course && hw.theme.course.name) {
            return hw.theme.course.name;
        }

        if (hw.theme_id && themesByCourse && Object.keys(themesByCourse).length > 0) {
            for (const [courseId, themes] of Object.entries(themesByCourse)) {
                const arr = Array.isArray(themes) ? themes : [];
                const t = arr.find(t => t.id === hw.theme_id);
                if (t) {
                    const c = coursesList.find(c => c.id === Number(courseId));
                    if (c) return c.name || `Курс #${c.id}`;
                    return `Курс #${courseId}`;
                }
            }
        }

        return "Неизвестно";
    }

    function getThemeNameForHomework(hw) {
        if (hw.theme_name) return hw.theme_name;
        if (hw.theme && hw.theme.name) return hw.theme.name;

        if (hw.theme_id && themesByCourse && Object.keys(themesByCourse).length > 0) {
            if (hw.course_id && themesByCourse[hw.course_id]) {
                const arr = Array.isArray(themesByCourse[hw.course_id]) ? themesByCourse[hw.course_id] : [];
                const t = arr.find(t => t.id === hw.theme_id);
                if (t) return t.name || `Тема #${t.id}`;
            }
            for (const themes of Object.values(themesByCourse)) {
                const arr = Array.isArray(themes) ? themes : [];
                const t = arr.find(t => t.id === hw.theme_id);
                if (t) return t.name || `Тема #${t.id}`;
            }
        }

        if (hw.title) return hw.title;
        if (hw.theme_id) return `Тема #${hw.theme_id}`;
        return "Тема не указана";
    }

    // ======== загрузка файлов темы ========

    async function uploadThemeFiles(themeId, inputEl, msgEl) {
        const files = inputEl?.files;
        if (!files || !files.length) return;

        const formData = new FormData();
        let hasFiles = false;

        for (const file of files) {
            if (file.size > 100 * 1024 * 1024) {
                if (msgEl) {
                    msgEl.textContent = `Файл "${file.name}" больше 100 МБ и не будет загружен.`;
                    msgEl.className = "message-box message-error";
                }
                continue;
            }
            formData.append("files", file);
            hasFiles = true;
        }

        if (!hasFiles) return;

        try {
            await apiFetch(`/files/theme/${themeId}/uploadfiles`, {
                method: "POST",
                body: formData
            });
            if (msgEl) {
                msgEl.textContent = "Файлы загружены.";
                msgEl.className = "message-box message-success";
            }
        } catch (e) {
            if (msgEl) {
                msgEl.textContent = "Ошибка загрузки файлов: " + e.message;
                msgEl.className = "message-box message-error";
            }
        }
    }

    async function loadThemeFiles(themeId, listEl) {
        if (!listEl) return;
        listEl.textContent = "Загрузка файлов...";

        try {
            const files = await apiFetch(`/files/theme/${themeId}/getfiles`);
            if (!Array.isArray(files) || !files.length) {
                listEl.textContent = "К этой теме пока не прикреплены файлы.";
                return;
            }

            listEl.innerHTML = "";
            files.forEach(file => {
                const item = document.createElement("div");
                item.className = "files-list-item";

                const link = document.createElement("a");
                link.href = BASE_URL + file.url;
                link.target = "_blank";
                link.rel = "noreferrer";
                link.className = "file-link";
                link.textContent = file.filename || getFileNameFromPath(file.url);
                
                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "file-delete-btn";
                deleteBtn.innerHTML = "×";
                deleteBtn.setAttribute("aria-label", "Удалить файл");
                
                deleteBtn.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await deleteThemeFile(file.id, themeId, listEl);
                });

                item.appendChild(link);
                item.appendChild(deleteBtn);
                listEl.appendChild(item);
            });
        } catch (e) {
            listEl.textContent = "Ошибка загрузки файлов темы: " + e.message;
        }
    }

    function getFileNameFromPath(path) {
        if (!path) return "";
        const parts = path.split("/");
        return parts[parts.length - 1] || path;
    }
    async function deleteThemeFile(fileId, themeId, listEl) {
        if (!confirm("Удалить этот файл?")) {
            return;
        }

        try {
            await apiFetch(`/files/${fileId}`, {
                method: "DELETE"
            });

            if (elThemeFormMsg) {
                elThemeFormMsg.textContent = "Файл удалён.";
                elThemeFormMsg.className = "message-box message-success";
            }

            await loadThemeFiles(themeId, listEl);
            
        } catch (e) {
            console.error("Ошибка при удалении файла:", e);
            
            if (elThemeFormMsg) {
                elThemeFormMsg.textContent = "Ошибка при удалении файла: " + e.message;
                elThemeFormMsg.className = "message-box message-error";
            }
        }
    }

}
