const BASE_URL = "https://merely-factual-platy.cloudpub.ru"; // поправь под свой бэк
const LOGIN_PAGE = "/front/templates/index.html";             // сюда отправляем после выхода

// Глобальные переменные
let currentUser = null;
let studentsList = [];
let coursesList = [];
let currentCourseId = null;
let currentCourse = null;
let themesByCourse = {}; // { courseId: [themes] }
let currentThemeId = null;
let currentTheme = null;

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
    // DOM элементы шапки
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

    // DOM: Мои ученики / домашки
    const elStudentsTableBody = document.querySelector("#students-table tbody");
    const elStudentsMsg = document.getElementById("students-message");

    const elFilterCourse = document.getElementById("filter-course");
    const elFilterTheme = document.getElementById("filter-theme");
    const elFilterStatus = document.getElementById("filter-status");
    const elFilterStudent = document.getElementById("filter-student");
    const elBtnApplyFilters = document.getElementById("btn-apply-filters");
    const elHomeworksTableBody = document.querySelector("#homeworks-table tbody");
    const elHomeworksMsg = document.getElementById("homeworks-message");

    // DOM: курсы/темы (левая часть)
    const elBtnAddCourse = document.getElementById("btn-add-course");
    const elCoursesList = document.getElementById("courses-list");
    const elThemesList = document.getElementById("themes-list");
    const elThemesMsg = document.getElementById("themes-message");

    // DOM: редактор курса
    const elCourseName = document.getElementById("course-name");
    const elCourseDesc = document.getElementById("course-description");
    const elBtnSaveCourse = document.getElementById("btn-save-course");
    const elBtnDeleteCourse = document.getElementById("btn-delete-course");
    const elCourseFormMsg = document.getElementById("course-form-message");

    // DOM: редактор темы
    const elThemeName = document.getElementById("theme-name");
    const elThemeText = document.getElementById("theme-text");
    const elThemeIsHomework = document.getElementById("theme-is-homework");
    const elThemeFiles = document.getElementById("theme-files");
    const elBtnSaveTheme = document.getElementById("btn-save-theme");
    const elBtnClearTheme = document.getElementById("btn-clear-theme");
    const elBtnDeleteTheme = document.getElementById("btn-delete-theme");
    const elThemeFormMsg = document.getElementById("theme-form-message");

    // Обработчики выхода
    elLogoutBtn.addEventListener("click", async () => {
        try {
            await apiFetch("/logout", { method: "POST", credentials: "include" });
        } catch (_) {
            // игнорируем, всё равно уходим
        }
        window.location.href = LOGIN_PAGE;
    });

    // Обновление списка домашек по фильтрам
    elBtnApplyFilters.addEventListener("click", () => {
        loadHomeworks();
    });

    // "Создать курс" — переводим форму справа в режим создания
    elBtnAddCourse.addEventListener("click", () => {
        currentCourseId = null;
        currentCourse = null;
        clearCourseForm();
        clearThemeForm(true);
        elCourseFormMsg.textContent = "Создание нового курса. Заполните поля и нажмите «Сохранить курс».";
        elCourseFormMsg.className = "message-box";
        document.querySelectorAll(".course-item").forEach(el => el.classList.remove("active"));
    });

    // Сохранить курс (создание или обновление)
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
                // редактирование
                saved = await apiFetch(`/courses/${currentCourseId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, description })
                });
                elCourseFormMsg.textContent = "Курс обновлён.";
            } else {
                // создание
                saved = await apiFetch("/courses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, description })
                });
                elCourseFormMsg.textContent = "Курс создан.";
            }
            elCourseFormMsg.className = "message-box message-success";

            await loadCourses();

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
            await loadHomeworks();
            await loadStudents();
        } catch (e) {
            elCourseFormMsg.textContent = "Ошибка при удалении курса: " + e.message;
            elCourseFormMsg.className = "message-box message-error";
        }
    });

    // Сохранить тему (создание / редактирование)
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
                // РЕДАКТИРОВАНИЕ темы
                savedTheme = await apiFetch(`/themes/theme/${currentThemeId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, text, is_homework })
                });
                elThemeFormMsg.textContent = "Тема обновлена.";
            } else {
                // СОЗДАНИЕ новой темы
                savedTheme = await apiFetch(`/themes/${currentCourseId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, text, is_homework })
                });
                elThemeFormMsg.textContent = "Тема создана.";
            }

            elThemeFormMsg.className = "message-box message-success";

            // TODO: загрузка файлов (если нужен upload — сделать отдельный эндпоинт)
            if (elThemeFiles.files.length > 0 && savedTheme && savedTheme.id) {
                // Примерный шаблон:
                // const fd = new FormData();
                // Array.from(elThemeFiles.files).forEach(f => fd.append("files", f));
                // await fetch(BASE_URL + `/themes/${savedTheme.id}/files`, {
                //     method: "POST",
                //     body: fd,
                //     credentials: "include"
                // });
            }

            await loadThemes(currentCourseId);
            await loadHomeworks();

            if (savedTheme && savedTheme.id) {
                onThemeClick(savedTheme.id, currentCourseId);
            }
        } catch (e) {
            elThemeFormMsg.textContent = "Ошибка при сохранении темы: " + e.message;
            elThemeFormMsg.className = "message-box message-error";
        }
    });

    // Очистить форму темы (и сбросить выбор)
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
            await loadHomeworks();
        } catch (e) {
            elThemeFormMsg.textContent = "Ошибка при удалении темы: " + e.message;
            elThemeFormMsg.className = "message-box message-error";
        }
    });

    // Основной сценарий: профиль -> загрузки
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

        await Promise.all([
            loadStudents(),
            loadCourses(),
            loadHomeworks()
        ]);
    } catch (e) {
        elGlobalMsg.textContent = "Ошибка: " + e.message;
    }

    // ================= ФУНКЦИИ ЗАГРУЗКИ =================

    async function loadStudents() {
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

                const opt = document.createElement("option");
                opt.value = student.id;
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
        elFilterTheme.innerHTML = '<option value="">Тема: все</option>';

        clearThemeForm(true);

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

                const opt = document.createElement("option");
                opt.value = theme.id;
                opt.textContent = theme.name || ("Тема #" + theme.id);
                elFilterTheme.appendChild(opt);

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

    function onThemeClick(themeId, courseId) {
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
        } else {
            clearThemeForm(false);
        }

        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";
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
                tdCourse.textContent = course?.name || `Неизвестно`;

                tdTheme.textContent = hw.title || (hw.theme_id ? `Тема #${hw.theme_id}` : "");

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

    // ================= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =================

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
        elThemeFormMsg.textContent = "";
        elThemeFormMsg.className = "message-box";
        if (clearSelection) {
            currentThemeId = null;
            currentTheme = null;
            document.querySelectorAll(".theme-item").forEach(el => el.classList.remove("active"));
        }
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
}