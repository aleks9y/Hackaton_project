const BASE_URL = "https://unwillingly-tonic-cougar.cloudpub.ru"; // поправь под свой бэк
const LOGIN_PAGE = "/front/templates/index.html";          // сюда отправляем после выхода

// Глобальные переменные
let currentUser = null;
let studentsList = [];
let coursesList = [];
let currentCourseId = null;
let themesByCourse = {}; // { courseId: [themes] }
let authToken = localStorage.getItem('access_token');

// Утилита для запросов
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

// Инициализация после загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
    init();
});

async function init() {
    // DOM элементы
    const elUserName = document.getElementById("user-name");
    const elUserRole = document.getElementById("user-role");
    const elLogoutBtn = document.getElementById("logout-btn");
    const elGlobalMsg = document.getElementById("global-message");

    const elStudentsTableBody = document.querySelector("#students-table tbody");
    const elStudentsMsg = document.getElementById("students-message");

    const elFilterCourse = document.getElementById("filter-course");
    const elFilterTheme = document.getElementById("filter-theme");
    const elFilterStatus = document.getElementById("filter-status");
    const elFilterStudent = document.getElementById("filter-student");
    const elBtnApplyFilters = document.getElementById("btn-apply-filters");
    const elHomeworksTableBody = document.querySelector("#homeworks-table tbody");
    const elHomeworksMsg = document.getElementById("homeworks-message");

    const elBtnAddCourse = document.getElementById("btn-add-course");
    const elCoursesList = document.getElementById("courses-list");
    const elThemesList = document.getElementById("themes-list");
    const elThemesMsg = document.getElementById("themes-message");

    const elThemeName = document.getElementById("theme-name");
    const elThemeText = document.getElementById("theme-text");
    const elBtnSaveTheme = document.getElementById("btn-save-theme");
    const elBtnClearTheme = document.getElementById("btn-clear-theme");
    const elThemeFormMsg = document.getElementById("theme-form-message");

    // ----- ЛОГИКА ВКЛАДОК PageActive -----
    const tabButtons = document.querySelectorAll(".tab-btn");
    const pageStudents = document.getElementById("page-students");
    const pageCourses = document.getElementById("page-courses");

    function setActivePage(pageKey) {
        if (!pageStudents || !pageCourses) return;

        // страницы
        pageStudents.classList.toggle("PageActive", pageKey === "students");
        pageCourses.classList.toggle("PageActive", pageKey === "courses");

        // кнопки
        tabButtons.forEach(btn => {
            const k = btn.dataset.page;
            btn.classList.toggle("PageActive", k === pageKey);
        });
    }

    if (tabButtons.length && pageStudents && pageCourses) {
        // стартовая страница — "Мои ученики"
        setActivePage("students");

        tabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const key = btn.dataset.page;
                setActivePage(key);
            });
        });
    }
    // ----- КОНЕЦ ЛОГИКИ ВКЛАДОК -----

    // Обработчики
    elLogoutBtn.addEventListener("click", async () => {
        try {
            await apiFetch("/logout", { method: "POST", credentials: "include" });
        } catch (_) {
            // игнорируем, всё равно выходим на логин
        }
        window.location.href = LOGIN_PAGE;
    });

    elBtnApplyFilters.addEventListener("click", () => {
        loadHomeworks();
    });

    elBtnAddCourse.addEventListener("click", async () => {
        const name = prompt("Название курса:");
        if (!name) return;
        const description = prompt("Краткое описание курса:") || "";

        elThemesMsg.textContent = "";
        elThemesMsg.className = "message-box";

        try {
            await apiFetch("/courses", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description })
            });
            await loadCourses(); // перечитать список
            elThemesMsg.textContent = "Курс создан.";
            elThemesMsg.className = "message-box message-success";
        } catch (e) {
            elThemesMsg.textContent = "Не удалось создать курс: " + e.message;
            elThemesMsg.className = "message-box message-error";
        }
    });

    elBtnSaveTheme.addEventListener("click", async () => {
        if (!currentCourseId) {
            elThemeFormMsg.textContent = "Сначала выберите курс.";
            elThemeFormMsg.className = "message-box message-error";
            return;
        }

        const name = elThemeName.value.trim();
        const text = elThemeText.value.trim();

        if (!name) {
            elThemeFormMsg.textContent = "Введите название темы.";
            elThemeFormMsg.className = "message-box message-error";
            return;
        }

        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";

        try {
            await apiFetch(`/themes/${currentCourseId}`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, text })
            });
            elThemeFormMsg.textContent = "Тема сохранена.";
            elThemeFormMsg.className = "message-box message-success";
            elThemeName.value = "";
            elThemeText.value = "";
            await loadThemes(currentCourseId);
        } catch (e) {
            elThemeFormMsg.textContent = "Ошибка при сохранении темы: " + e.message;
            elThemeFormMsg.className = "message-box message-error";
        }
    });

    elBtnClearTheme.addEventListener("click", () => {
        elThemeName.value = "";
        elThemeText.value = "";
        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";
    });

    // Основной сценарий: профиль -> проверки -> загрузки
    try {
        elGlobalMsg.textContent = "Загрузка профиля...";
        currentUser = await apiFetch("/auth/me");

        elUserName.textContent = currentUser.fullname || currentUser.email || "Пользователь";
        elUserRole.textContent = currentUser.is_teacher ? "Преподаватель" : "Студент";

        if (!currentUser.is_teacher) {
            elGlobalMsg.textContent = "Этот кабинет доступен только преподавателям.";
            return;
        }

        elGlobalMsg.textContent = "";

        // Параллельно загружаем базовые данные
        await Promise.all([
            loadStudents(),
            loadCourses(),
            loadHomeworks()
        ]);
    } catch (e) {
        elGlobalMsg.textContent = "Ошибка: " + e.message;
    }

    // ======== ФУНКЦИИ ЗАГРУЗКИ ========

    async function loadStudents() {
        elStudentsMsg.textContent = "Загрузка студентов...";
        elStudentsMsg.className = "message-box";
        elStudentsTableBody.innerHTML = "";
        elFilterStudent.innerHTML = '<option value="">Студент: все</option>';

        try {
            // Получаем список курсов преподавателя
            const courses = await apiFetch("/courses/my");

            if (!Array.isArray(courses) || courses.length === 0) {
                elStudentsMsg.textContent = "У вас пока нет курсов.";
                elStudentsMsg.className = "message-box";
                return;
            }

            // Собираем всех студентов со всех курсов
            studentsList = [];

            for (const course of courses) {
                try {
                    const courseStudents = await apiFetch(`/courses/${course.id}/students`);
                    if (Array.isArray(courseStudents)) {
                        courseStudents.forEach(student => {
                            if (!studentsList.find(s => s.id === student.id)) {
                                studentsList.push(student);
                            }
                        });
                    }
                } catch (e) {
                    console.error(`Ошибка загрузки студентов курса ${course.id}:`, e);
                }
            }

            if (studentsList.length === 0) {
                elStudentsMsg.textContent = "На ваших курсах пока нет студентов.";
                elStudentsMsg.className = "message-box";
                return;
            }

            // Отображаем студентов в таблице
            studentsList.forEach(student => {
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

                // опция фильтра по студенту
                const opt = document.createElement("option");
                opt.value = student.id;
                opt.textContent = student.full_name || student.email || ("ID " + student.id);
                elFilterStudent.appendChild(opt);
            });

            elStudentsMsg.textContent = `Загружено ${studentsList.length} студентов`;
            elStudentsMsg.className = "message-box message-success";

        } catch (e) {
            console.error('Ошибка загрузки студентов:', e);
            elStudentsMsg.textContent = "Ошибка загрузки студентов: " + e.message;
            elStudentsMsg.className = "message-box message-error";
        }
    }

    async function loadCourses() {
        elCoursesList.innerHTML = "";
        elThemesList.innerHTML = "";
        elThemesMsg.textContent = "";
        elFilterCourse.innerHTML = '<option value="">Курс: все</option>';
        elFilterTheme.innerHTML = '<option value="">Тема: все</option>';
        themesByCourse = {};
        currentCourseId = null;

        try {
            coursesList = await apiFetch("/courses/my");

            if (!Array.isArray(coursesList) || coursesList.length === 0) {
                elCoursesList.innerHTML = '<span class="muted-text">У вас пока нет курсов.</span>';
                return;
            }

            coursesList.forEach(course => {
                // карточка курса справа
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

                // опция фильтра по курсу (для ДЗ)
                const opt = document.createElement("option");
                opt.value = course.id;
                opt.textContent = course.name || ("Курс #" + course.id);
                elFilterCourse.appendChild(opt);
            });
        } catch (e) {
            elThemesMsg.textContent = "Ошибка загрузки курсов: " + e.message;
            elThemesMsg.className = "message-box message-error";
        }
    }

    async function onCourseClick(courseId) {
        currentCourseId = courseId;

        // подсветка выбранного курса
        document.querySelectorAll(".course-item").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.courseId) === courseId);
        });

        // ставим фильтр по курсу и очищаем фильтр по теме
        elFilterCourse.value = String(courseId);
        elFilterTheme.innerHTML = '<option value="">Тема: все</option>';

        await loadThemes(courseId);
        await loadHomeworks();
    }

    async function loadThemes(courseId) {
        elThemesList.innerHTML = "";
        elThemesMsg.textContent = "Загрузка тем...";
        elThemesMsg.className = "message-box";
        elFilterTheme.innerHTML = '<option value="">Тема: все</option>';

        try {
            const themes = await apiFetch(`/themes/${courseId}`);
            themesByCourse[courseId] = themes;

            if (!Array.isArray(themes) || themes.length === 0) {
                elThemesList.innerHTML = '<span class="muted-text">Тем пока нет.</span>';
                elThemesMsg.textContent = "";
                return;
            }

            themes.forEach(theme => {
                const item = document.createElement("div");
                item.className = "theme-item";

                const main = document.createElement("div");
                main.className = "theme-item-main";

                const title = document.createElement("div");
                title.className = "theme-item-title";
                title.textContent = theme.name || ("Тема #" + theme.id);

                main.appendChild(title);
                item.appendChild(main);
                elThemesList.appendChild(item);

                // опция фильтра по теме
                const opt = document.createElement("option");
                opt.value = theme.id;
                opt.textContent = theme.name || ("Тема #" + theme.id);
                elFilterTheme.appendChild(opt);
            });

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

            if (!Array.isArray(homeworks) || homeworks.length === 0) {
                elHomeworksMsg.textContent = "Домашних заданий не найдено.";
                elHomeworksMsg.className = "message-box";
                return;
            }

            homeworks.forEach(hw => {
                const tr = document.createElement("tr");

                const tdId = document.createElement("td");
                const tdCourse = document.createElement("td");
                const tdTheme = document.createElement("td");
                const tdStudent = document.createElement("td");
                const tdStatus = document.createElement("td");

                tdId.textContent = hw.id ?? "";

                const course = coursesList.find(c => c.id === hw.course_id);
                tdCourse.textContent = course
                    ? (course.name || `Курс #${course.id}`)
                    : (hw.course_id ? `ID ${hw.course_id}` : "");

                tdTheme.textContent = hw.theme_id ? `${hw.title}` : "";

                const student = studentsList.find(s => s.id === hw.student_id);
                tdStudent.textContent = student
                    ? (student.fullname || student.email || `ID ${student.id}`)
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

                tr.appendChild(tdId);
                tr.appendChild(tdCourse);
                tr.appendChild(tdTheme);
                tr.appendChild(tdStudent);
                tr.appendChild(tdStatus);

                elHomeworksTableBody.appendChild(tr);
            });

            elHomeworksMsg.textContent = "";
            elHomeworksMsg.className = "message-box";
        } catch (e) {
            elHomeworksMsg.textContent = "Ошибка загрузки домашних заданий: " + e.message;
            elHomeworksMsg.className = "message-box message-error";
        }
    }

    // Вспомогательная функция для инициалов
    function getInitials(name) {
        if (!name) return "";
        return name
            .split(" ")
            .filter(Boolean)
            .map(w => w[0].toUpperCase())
            .slice(0, 2)
            .join("");
    }
}