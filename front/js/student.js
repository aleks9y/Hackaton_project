// Настройки
const BASE_URL = "https://unwillingly-tonic-cougar.cloudpub.ru"; // поправь под свой бэк
const LOGIN_PAGE = "/front/templates/index.html";

// Глобальные переменные
let currentUser = null;
let allCoursesList = [];
let myCoursesList = [];
let currentCourse = null;
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
    // DOM элементы
    const elUserName = document.getElementById("user-name");
    const elUserRole = document.getElementById("user-role");
    const elLogoutBtn = document.getElementById("logout-btn");
    const elGlobalMsg = document.getElementById("global-message");

    // Элементы страницы личного кабинета
    const elSearchInput = document.getElementById("search-input");
    const elSearchBtn = document.getElementById("search-btn");
    const elShowAllLink = document.getElementById("show-all-link");
    const elAllCoursesList = document.getElementById("all-courses-list");
    const elAllCoursesMsg = document.getElementById("all-courses-message");
    const elMyCoursesList = document.getElementById("my-courses-list");
    const elMyCoursesMsg = document.getElementById("my-courses-message");

    // Элементы страницы курса
    const elPageDashboard = document.getElementById("page-student-dashboard");
    const elPageCourseDetail = document.getElementById("page-course-detail");
    const elCourseTitle = document.getElementById("course-title");
    const elCourseMeta = document.getElementById("course-meta");
    const elCourseProgress = document.getElementById("course-progress");
    const elThemesList = document.getElementById("themes-list");
    const elThemesMsg = document.getElementById("themes-message");
    const elBackToDashboard = document.getElementById("back-to-dashboard");
    const elThemeTitleHeading = document.getElementById("theme-title-heading");
    const elThemeText = document.getElementById("theme-text");
    const elHomeworkSection = document.getElementById("homework-section");
    const elHomeworkAnswer = document.getElementById("homework-answer");
    const elBtnSendHomework = document.getElementById("btn-send-homework");
    const elHomeworkMessage = document.getElementById("homework-message");
    const elTeacherAnswerSection = document.getElementById("teacher-answer-section");
    const elTeacherAnswerBlock = document.getElementById("teacher-answer-block");

    // Обработчики
    elLogoutBtn.addEventListener("click", async () => {
        try {
            await apiFetch("/auth/logout", { method: "POST" });
        } catch (_) {
            // игнорируем
        }
        localStorage.removeItem('auth_token');
        window.location.href = LOGIN_PAGE;
    });

    elSearchBtn.addEventListener("click", () => {
        const searchTerm = elSearchInput.value.trim();
        loadAllCourses(searchTerm);
    });

    elShowAllLink.addEventListener("click", () => {
        elSearchInput.value = "";
        loadAllCourses();
    });

    elBackToDashboard.addEventListener("click", () => {
        showDashboard();
    });

    elBtnSendHomework.addEventListener("click", async () => {
        await submitHomework();
    });

    // Основной сценарий
    try {
        elGlobalMsg.textContent = "Загрузка профиля...";
        currentUser = await apiFetch("/auth/me");

        elUserName.textContent = currentUser.full_name || currentUser.email || "Студент";
        elUserRole.textContent = "Студент";

        elGlobalMsg.textContent = "";

        // Загружаем данные
        await Promise.all([
            loadAllCourses(),
            loadMyCourses()
        ]);

    } catch (e) {
        console.error('Ошибка инициализации:', e);
        elGlobalMsg.textContent = "Ошибка: " + e.message;
        
        if (e.message.includes('Not authenticated') || e.message.includes('401')) {
            setTimeout(() => {
                window.location.href = LOGIN_PAGE;
            }, 2000);
        }
    }

    // Функции загрузки данных

    async function loadAllCourses(searchTerm = "") {
        elAllCoursesMsg.textContent = "Загрузка курсов...";
        elAllCoursesMsg.className = "message-box";

        try {
            // Получаем все курсы
            allCoursesList = await apiFetch("/courses/all");
            
            // Фильтруем по поисковому запросу
            let filteredCourses = allCoursesList;
            if (searchTerm) {
                filteredCourses = allCoursesList.filter(course => 
                    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
                );
            }

            elAllCoursesList.innerHTML = "";

            if (!Array.isArray(filteredCourses) || filteredCourses.length === 0) {
                elAllCoursesMsg.textContent = searchTerm 
                    ? "Курсы по вашему запросу не найдены." 
                    : "Курсы пока не добавлены.";
                return;
            }

            filteredCourses.forEach(course => {
                // Используем флаг is_enrolled из ответа API вместо myCoursesList
                const isEnrolled = course.is_enrolled === true;
                
                const courseCard = document.createElement("div");
                courseCard.className = "course-card";
                
                courseCard.innerHTML = `
                    <div class="course-card-main">
                        <div class="course-name">${course.name || "Курс без названия"}</div>
                        <div class="course-desc">${course.description || "Описание отсутствует"}</div>
                        <div class="course-meta">
                            ${course.owner ? `Преподаватель: ${course.owner.full_name}` : ''}
                        </div>
                    </div>
                    <div>
                        ${isEnrolled ? 
                            `<button class="btn btn-sm" onclick="openCourse(${course.id})">Перейти</button>` :
                            `<button class="btn btn-sm btn-secondary" onclick="enrollCourse(${course.id})">Записаться</button>`
                        }
                    </div>
                `;
                
                elAllCoursesList.appendChild(courseCard);
            });

            elAllCoursesMsg.textContent = `Найдено курсов: ${filteredCourses.length}`;
            elAllCoursesMsg.className = "message-box message-success";

        } catch (e) {
            console.error('Ошибка загрузки курсов:', e);
            elAllCoursesMsg.textContent = "Ошибка загрузки курсов: " + e.message;
            elAllCoursesMsg.className = "message-box message-error";
        }
    }

    async function loadMyCourses() {
        elMyCoursesMsg.textContent = "Загрузка ваших курсов...";
        elMyCoursesMsg.className = "message-box";

        try {
            myCoursesList = await apiFetch("/courses/my");

            elMyCoursesList.innerHTML = "";

            if (!Array.isArray(myCoursesList) || myCoursesList.length === 0) {
                elMyCoursesMsg.textContent = "Вы пока не записаны на курсы.";
                return;
            }

            myCoursesList.forEach(course => {
                const courseCard = document.createElement("div");
                courseCard.className = "course-card";
                
                courseCard.innerHTML = `
                    <div class="course-card-main">
                        <div class="course-name">${course.name || "Курс без названия"}</div>
                        <div class="course-desc">${course.description || "Описание отсутствует"}</div>
                        <div class="course-meta">
                            Тем: ${course.themes_count || 0}
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-sm" onclick="openCourse(${course.id})">Перейти</button>
                    </div>
                `;
                
                elMyCoursesList.appendChild(courseCard);
            });

            elMyCoursesMsg.textContent = `Ваших курсов: ${myCoursesList.length}`;
            elMyCoursesMsg.className = "message-box message-success";

        } catch (e) {
            console.error('Ошибка загрузки ваших курсов:', e);
            elMyCoursesMsg.textContent = "Ошибка загрузки ваших курсов: " + e.message;
            elMyCoursesMsg.className = "message-box message-error";
        }
    }

    async function openCourse(courseId) {
        try {
            // Загружаем информацию о курсе
            currentCourse = await apiFetch(`/courses/${courseId}`);
            
            // Загружаем темы курса
            const themes = await apiFetch(`/themes/${courseId}`);
            
            // Показываем страницу курса
            showCourseDetail(currentCourse, themes);
            
        } catch (e) {
            console.error('Ошибка открытия курса:', e);
            alert("Ошибка загрузки курса: " + e.message);
        }
    }

    function showCourseDetail(course, themes) {
        // Обновляем информацию о курсе
        elCourseTitle.textContent = course.name || "Курс без названия";
        elCourseMeta.textContent = course.description || "Описание отсутствует";
        elCourseProgress.textContent = "Прогресс: не отслеживается";

        // Заполняем список тем
        elThemesList.innerHTML = "";
        
        if (!Array.isArray(themes) || themes.length === 0) {
            elThemesList.innerHTML = '<div class="muted-text">Темы пока не добавлены</div>';
        } else {
            themes.forEach(theme => {
                const themeItem = document.createElement("div");
                themeItem.className = "theme-item";
                themeItem.innerHTML = `
                    <div class="theme-title">${theme.name || "Тема без названия"}</div>
                    <div class="theme-type">${theme.is_homework ? "Домашнее задание" : "Учебный материал"}</div>
                `;
                
                themeItem.addEventListener("click", () => {
                    // Снимаем выделение со всех тем
                    document.querySelectorAll(".theme-item").forEach(item => {
                        item.classList.remove("theme-item-active");
                    });
                    // Выделяем текущую тему
                    themeItem.classList.add("theme-item-active");
                    
                    showThemeContent(theme);
                });
                
                elThemesList.appendChild(themeItem);
            });
        }

        // Показываем страницу курса
        elPageDashboard.style.display = "none";
        elPageCourseDetail.style.display = "block";
        
        // Сбрасываем контент темы
        resetThemeContent();
    }

    function showThemeContent(theme) {
        currentTheme = theme;
        
        elThemeTitleHeading.textContent = theme.name || "Тема без названия";
        elThemeText.textContent = theme.text || "Содержание темы отсутствует";
        
        // Показываем/скрываем секцию домашнего задания
        if (theme.is_homework) {
            elHomeworkSection.style.display = "block";
            elTeacherAnswerSection.style.display = "block";
            
            // TODO: Загрузить существующее домашнее задание и ответ преподавателя
            loadHomeworkData(theme.id);
        } else {
            elHomeworkSection.style.display = "none";
            elTeacherAnswerSection.style.display = "none";
        }
    }

    function resetThemeContent() {
        elThemeTitleHeading.textContent = "Тема";
        elThemeText.textContent = "Выберите тему слева, чтобы увидеть материалы.";
        elHomeworkSection.style.display = "none";
        elTeacherAnswerSection.style.display = "none";
        elHomeworkAnswer.value = "";
        elHomeworkMessage.textContent = "";
    }

    function showDashboard() {
        elPageCourseDetail.style.display = "none";
        elPageDashboard.style.display = "block";
        currentCourse = null;
        currentTheme = null;
    }

    async function loadHomeworkData(themeId) {
        // TODO: Реализовать загрузку существующего домашнего задания
        // и ответа преподавателя
        elTeacherAnswerBlock.textContent = "Пока нет данных по проверке.";
    }

    async function submitHomework() {
        const answer = elHomeworkAnswer.value.trim();
        
        if (!answer) {
            elHomeworkMessage.textContent = "Введите ответ на задание";
            elHomeworkMessage.className = "message-box message-error";
            return;
        }

        if (!currentTheme) {
            elHomeworkMessage.textContent = "Тема не выбрана";
            elHomeworkMessage.className = "message-box message-error";
            return;
        }

        try {
            elHomeworkMessage.textContent = "Отправка...";
            elHomeworkMessage.className = "message-box";

            await apiFetch(`/homeworks/${currentTheme.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: currentTheme.name,
                    text: answer
                })
            });

            elHomeworkMessage.textContent = "Домашнее задание отправлено на проверку!";
            elHomeworkMessage.className = "message-box message-success";
            
            // Очищаем поле ответа
            elHomeworkAnswer.value = "";

        } catch (e) {
            console.error('Ошибка отправки домашнего задания:', e);
            elHomeworkMessage.textContent = "Ошибка отправки: " + e.message;
            elHomeworkMessage.className = "message-box message-error";
        }
    }

    // Глобальные функции для кнопок
    window.enrollCourse = async function(courseId) {
        try {
            await apiFetch(`/courses/${courseId}/enroll`, {
                method: "POST"
            });
            
            alert("Вы успешно записались на курс!");
            
            // Перезагружаем списки курсов
            await loadAllCourses();
            await loadMyCourses();
            
        } catch (e) {
            console.error('Ошибка записи на курс:', e);
            alert("Ошибка записи на курс: " + e.message);
        }
    };

    window.openCourse = openCourse;
}

// Добавьте эту функцию для получения токена из кук (если нужно)
function getTokenFromCookies() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'access_token') {
            return value;
        }
    }
    return null;
}