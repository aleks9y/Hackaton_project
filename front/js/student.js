// Настройки
const BASE_URL = "https://merely-factual-platy.cloudpub.ru"; // поправь под свой бэк
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
    const elCourseProgressLabel = document.getElementById("course-progress-label");
    const elCourseProgressBar = document.getElementById("course-progress-bar");
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

    document.getElementById("hw-file").addEventListener("change", async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (!currentTheme) {
            elHomeworkMessage.textContent = "Сначала выберите тему";
            elHomeworkMessage.className = "message-box message-error";
            e.target.value = "";
            return;
        }

        try {
            elHomeworkMessage.textContent = "Загрузка файлов...";
            elHomeworkMessage.className = "message-box";
            
            const uploadedFiles = await uploadHomeworkFiles(files, currentTheme.id);
            
            // Добавляем загруженные файлы в текущий список
            currentHomeworkFiles = [...currentHomeworkFiles, ...uploadedFiles];
            updateStudentFilesList();
            
        } catch (e) {
            console.error('Ошибка при загрузке файлов:', e);
        } finally {
            e.target.value = ""; // сбрасываем input
        }
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
                // Используем флаг is_enrolled из ответа API
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

            // Загружаем прогресс для каждого курса
            const coursesWithProgress = await Promise.all(
                myCoursesList.map(async (course) => {
                    try {
                        const progress = await loadCourseProgress(course.id);
                        return {
                            ...course,
                            progress_percentage: progress ? progress.progress_percentage : 0
                        };
                    } catch (e) {
                        console.error(`Ошибка загрузки прогресса для курса ${course.id}:`, e);
                        return {
                            ...course,
                            progress_percentage: 0
                        };
                    }
                })
            );

            coursesWithProgress.forEach(course => {
                const percentage = course.progress_percentage || 0;
                
                const courseCard = document.createElement("div");
                courseCard.className = "course-card";
                
                courseCard.innerHTML = `
                    <div class="course-card-main">
                        <div class="course-name">${course.name || "Курс без названия"}</div>
                        <div class="course-desc">${course.description || "Описание отсутствует"}</div>
                        <div class="course-meta">
                            Тем: ${course.themes_count || 0}
                        </div>
                        <!-- Добавляем прогресс-бар -->
                        <div class="course-progress">
                            <div class="course-progress-bar">
                                <div class="course-progress-fill" style="width: ${percentage}%"></div>
                            </div>
                            <div class="course-progress-text">Прогресс: ${Math.round(percentage)}%</div>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-sm" onclick="openCourse(${course.id})">Перейти</button>
                    </div>
                `;
                
                elMyCoursesList.appendChild(courseCard);
            });

            elMyCoursesMsg.textContent = `Ваших курсов: ${coursesWithProgress.length}`;
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
            await showCourseDetail(currentCourse, themes);
            
        } catch (e) {
            console.error('Ошибка открытия курса:', e);
            alert("Ошибка загрузки курса: " + e.message);
        }
    }

    async function showCourseDetail(course, themes) {
        // Обновляем информацию о курсе
        elCourseTitle.textContent = course.name || "Курс без названия";
        elCourseMeta.textContent = course.description || "Описание отсутствует";

        // Загружаем прогресс по курсу
        const progress = await loadCourseProgress(course.id);
        
        // Подготовим карту прогресса
        let progressMap = {};
        let completedCount = 0;
        let totalCount = 0;
        let percentage = 0;

        if (progress) {
            totalCount = progress.total_count || 0;
            completedCount = progress.completed_count || 0;
            percentage = progress.progress_percentage || 0;

            if (Array.isArray(progress.themes_progress)) {
                progress.themes_progress.forEach(tp => {
                    progressMap[tp.theme_id] = tp;
                });
            }

            elCourseProgressLabel.textContent = `Прогресс: ${completedCount}/${totalCount} (${Math.round(percentage)}%)`;
            elCourseProgressBar.style.width = `${Math.min(Math.max(percentage, 0), 100)}%`;
        } else {
            elCourseProgressLabel.textContent = "Прогресс: не отслеживается";
            elCourseProgressBar.style.width = "0%";
        }

        // Заполняем список тем
        elThemesList.innerHTML = "";
        
        if (!Array.isArray(themes) || themes.length === 0) {
            elThemesList.innerHTML = '<div class="muted-text">Темы пока не добавлены</div>';
        } else {
            themes.forEach(theme => {
                const themeProgress = progressMap[theme.id];
                const isCompleted = themeProgress && themeProgress.is_completed;

                const themeItem = document.createElement("div");
                themeItem.className = "theme-item";
                
                if (isCompleted && !theme.is_homework) {
                    themeItem.classList.add("theme-item-completed");
                }

                themeItem.innerHTML = `
                    <div class="theme-title">${theme.name || "Тема без названия"}</div>
                    <div class="theme-type">${theme.is_homework ? "Домашнее задание" : "Учебный материал"}</div>
                    ${isCompleted && !theme.is_homework ? '<div class="theme-status">✓ Пройдено</div>' : ''}
                `;

                themeItem.addEventListener("click", async () => {
                    // Снимаем выделение со всех тем
                    document.querySelectorAll(".theme-item").forEach(item => {
                        item.classList.remove("theme-item-active");
                    });
                    // Выделяем текущую тему
                    themeItem.classList.add("theme-item-active");

                    // Если это учебный материал (не ДЗ), отмечаем как пройденную
                    if (!theme.is_homework) {
                        await markThemeAsCompleted(theme.id);

                        // Обновляем прогресс и визуальное состояние
                        const newProgress = await loadCourseProgress(course.id);
                        if (newProgress) {
                            const newCompleted = newProgress.completed_count || 0;
                            const newTotal = newProgress.total_count || 0;
                            const newPercent = newProgress.progress_percentage || 0;

                            elCourseProgressLabel.textContent = `Прогресс: ${newCompleted}/${newTotal} (${Math.round(newPercent)}%)`;
                            elCourseProgressBar.style.width = `${Math.min(Math.max(newPercent, 0), 100)}%`;

                            // Обновляем стиль темы
                            themeItem.classList.add("theme-item-completed");
                            if (!themeItem.querySelector(".theme-status")) {
                                const statusDiv = document.createElement("div");
                                statusDiv.className = "theme-status";
                                statusDiv.textContent = "✓ Пройдено";
                                themeItem.appendChild(statusDiv);
                            }
                        }
                    }

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

    let currentHomeworkFiles = [];

    function showThemeContent(theme) {
        currentTheme = theme;
        
        elThemeTitleHeading.textContent = theme.name || "Тема без названия";
        elThemeText.textContent = theme.text || "Содержание темы отсутствует";
        
        // Показываем файлы преподавателя для ВСЕХ тем
        document.getElementById("teacher-files-section").style.display = "block";
        loadThemeFiles(theme.id);
        
        // Показываем/скрываем секцию домашнего задания
        if (theme.is_homework) {
            elHomeworkSection.style.display = "block";
            elTeacherAnswerSection.style.display = "block";
            document.getElementById("student-files-section").style.display = "block";
            
            // Загружаем данные по домашнему заданию и файлы студента
            loadHomeworkData(theme.id);
        } else {
            elHomeworkSection.style.display = "none";
            elTeacherAnswerSection.style.display = "none";
            document.getElementById("student-files-section").style.display = "none";
        }
    }

    // Загрузка файлов преподавателя
    async function loadThemeFiles(themeId) {
        const filesListEl = document.getElementById("theme-files-list");
        if (!filesListEl) return;
        
        filesListEl.innerHTML = "Загрузка файлов преподавателя...";

        try {
            // Загружаем файлы преподавателя (is_homework=false)
            const files = await apiFetch(`/files/theme/${themeId}/getfiles?is_homework=false`);
            
            if (!Array.isArray(files) || files.length === 0) {
                filesListEl.innerHTML = '<div class="muted-text">Файлы преподавателя отсутствуют</div>';
                return;
            }

            filesListEl.innerHTML = "";
            files.forEach(file => {
                const item = document.createElement("div");
                item.className = "files-list-item";

                // Используем правильный URL для скачивания файлов преподавателя
                const filename = file.filename || getFileNameFromPath(file.url);
                const link = document.createElement("a");
                link.href = BASE_URL + `/uploads/themes/${themeId}/${filename}`;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.className = "file-link";
                link.textContent = filename;
                
                // Добавляем пометку, что это файл преподавателя
                const teacherBadge = document.createElement("span");
                teacherBadge.className = "teacher-file-badge";
                teacherBadge.textContent = " (преподаватель)";
                
                item.appendChild(link);
                item.appendChild(teacherBadge);
                filesListEl.appendChild(item);
            });
        } catch (e) {
            console.error('Ошибка загрузки файлов преподавателя:', e);
            filesListEl.innerHTML = '<div class="muted-text">Ошибка загрузки файлов преподавателя</div>';
        }
    }

    // Загрузка файлов домашнего задания студента
    async function uploadHomeworkFiles(files, themeId) {
        if (!files || !files.length) return [];

        const formData = new FormData();
        let hasFiles = false;

        for (const file of files) {
            if (file.size > 100 * 1024 * 1024) {
                elHomeworkMessage.textContent = `Файл "${file.name}" больше 100 МБ и не будет загружен.`;
                elHomeworkMessage.className = "message-box message-error";
                continue;
            }
            formData.append("files", file);
            hasFiles = true;
        }

        if (!hasFiles) return [];

        try {
            const uploadedFiles = await apiFetch(`/files/theme/${themeId}/uploadfiles`, {
                method: "POST",
                body: formData
            });
            
            elHomeworkMessage.textContent = "Файлы загружены.";
            elHomeworkMessage.className = "message-box message-success";
            
            return Array.isArray(uploadedFiles) ? uploadedFiles : [];
        } catch (e) {
            console.error('Ошибка загрузки файлов домашнего задания:', e);
            elHomeworkMessage.textContent = "Ошибка загрузки файлов: " + e.message;
            elHomeworkMessage.className = "message-box message-error";
            return [];
        }
    }

    // Обновление списка файлов студента
    function updateStudentFilesList() {
        const filesListEl = document.getElementById("student-files-list");
        if (!filesListEl) return;
        
        filesListEl.innerHTML = "";

        if (currentHomeworkFiles.length === 0) {
            filesListEl.innerHTML = '<div class="muted-text">Файлы не прикреплены</div>';
            return;
        }

        currentHomeworkFiles.forEach((file, index) => {
            const item = document.createElement("div");
            item.className = "student-file-item";

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
            
            deleteBtn.addEventListener("click", async () => {
                try {
                    await deleteHomeworkFile(file.id);
                    currentHomeworkFiles.splice(index, 1);
                    updateStudentFilesList();
                } catch (e) {
                    console.error('Ошибка удаления файла:', e);
                    alert("Ошибка удаления файла: " + e.message);
                }
            });

            item.appendChild(nameSpan);
            item.appendChild(deleteBtn);
            filesListEl.appendChild(item);
        });
    }

    // Вспомогательная функция для получения имени файла из пути
    function getFileNameFromPath(path) {
        if (!path) return "";
        const parts = path.split("/");
        return parts[parts.length - 1] || path;
    }

    function resetThemeContent() {
        elThemeTitleHeading.textContent = "Тема";
        elThemeText.textContent = "Выберите тему слева, чтобы увидеть материалы.";
        elHomeworkSection.style.display = "none";
        elTeacherAnswerSection.style.display = "none";
        document.getElementById("teacher-files-section").style.display = "none";
        document.getElementById("student-files-section").style.display = "none";
        elHomeworkAnswer.value = "";
        elHomeworkMessage.textContent = "";
        currentHomeworkFiles = [];
        updateStudentFilesList();
    }

    function showDashboard() {
        elPageCourseDetail.style.display = "none";
        elPageDashboard.style.display = "block";
        currentCourse = null;
        currentTheme = null;
    }

    async function deleteHomeworkFile(fileId) {
        try {
            await apiFetch(`/files/${fileId}`, {
                method: "DELETE"
            });
        } catch (e) {
            console.error('Ошибка удаления файла:', e);
            throw new Error("Не удалось удалить файл");
        }
    }

    async function loadHomeworkData(themeId) {
        try {
            // Загружаем существующее домашнее задание студента
            const existingHomework = await loadExistingHomework(themeId);
            
            if (existingHomework) {
                elHomeworkAnswer.value = existingHomework.text || "";
            } else {
                elHomeworkAnswer.value = "";
            }

            // Загружаем файлы существующего домашнего задания
            await loadExistingHomeworkFiles(themeId);

            // Загружаем ответ преподавателя
            await loadTeacherFeedback(themeId);
            
        } catch (e) {
            console.error('Ошибка загрузки данных домашнего задания:', e);
        }
    }

    async function loadTeacherFeedback(themeId) {
        try {
            const homeworks = await apiFetch(`/homeworks/my?theme_id=${themeId}`);
            if (Array.isArray(homeworks) && homeworks.length > 0) {
                const homework = homeworks[0];
                
                // Проверяем наличие submission с оценкой
                if (homework.submission && (homework.submission.score || homework.submission.teacher_comment)) {
                    let feedbackHTML = '';
                    
                    // Оценка
                    if (homework.submission.score) {
                        feedbackHTML += `<div class="grade-score"><strong>Оценка:</strong> ${homework.submission.score}/10</div>`;
                    } else {
                        feedbackHTML += `<div><strong>Оценка:</strong> Ожидает оценки</div>`;
                    }
                    
                    // Комментарий преподавателя
                    if (homework.submission.teacher_comment) {
                        feedbackHTML += `<div style="margin-top: 12px;"><strong>Комментарий преподавателя:</strong></div>`;
                        feedbackHTML += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 8px; border: 1px solid #e2e8f0;">${homework.submission.teacher_comment}</div>`;
                    } else {
                        feedbackHTML += `<div style="margin-top: 12px;"><strong>Комментарий преподавателя:</strong> Ожидает комментария</div>`;
                    }
                    
                    // Дата проверки
                    if (homework.submission.submitted_at) {
                        const date = new Date(homework.submission.submitted_at).toLocaleDateString('ru-RU');
                        feedbackHTML += `<div style="margin-top: 12px;"><strong>Проверено:</strong> ${date}</div>`;
                    }
                    
                    elTeacherAnswerBlock.innerHTML = feedbackHTML;
                    elTeacherAnswerSection.style.display = "block";
                } else {
                    // Если проверки еще нет
                    elTeacherAnswerBlock.innerHTML = `
                        <div style="text-align: center; color: #6b7280; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                            <div><strong>Ожидается проверка преподавателем</strong></div>
                            <div style="margin-top: 8px; font-size: 14px;">Ваша работа отправлена и будет проверена в ближайшее время</div>
                        </div>
                    `;
                    elTeacherAnswerSection.style.display = "block";
                }
            } else {
                // Если домашнее задание еще не отправлено
                elTeacherAnswerBlock.innerHTML = `
                    <div style="text-align: center; color: #6b7280; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📤</div>
                        <div><strong>Работа еще не отправлена</strong></div>
                        <div style="margin-top: 8px; font-size: 14px;">Отправьте домашнее задание, чтобы преподаватель мог его проверить</div>
                    </div>
                `;
                elTeacherAnswerSection.style.display = "block";
            }
        } catch (e) {
            console.error('Ошибка загрузки ответа преподавателя:', e);
            elTeacherAnswerBlock.innerHTML = `
                <div class="message-error">
                    Ошибка загрузки данных проверки: ${e.message}
                </div>
            `;
            elTeacherAnswerSection.style.display = "block";
        }
    }

    // Загрузка существующего домашнего задания
    async function loadExistingHomework(themeId) {
        try {
            const homeworks = await apiFetch(`/homeworks/my?theme_id=${themeId}`);
            return Array.isArray(homeworks) && homeworks.length > 0 ? homeworks[0] : null;
        } catch (e) {
            console.error('Ошибка загрузки существующего ДЗ:', e);
            return null;
        }
    }

    // Загрузка файлов существующего домашнего задания
    // Загрузка файлов существующего домашнего задания студента
    async function loadExistingHomeworkFiles(themeId) {
        try {
            // Загружаем студенческие файлы (is_homework=true)
            const studentFiles = await apiFetch(`/files/theme/${themeId}/getfiles?is_homework=true`);
            currentHomeworkFiles = Array.isArray(studentFiles) ? studentFiles : [];
            updateStudentFilesList();
        } catch (e) {
            console.error('Ошибка загрузки файлов ДЗ:', e);
            currentHomeworkFiles = [];
            updateStudentFilesList();
        }
    }

    async function submitHomework() {
        const answer = elHomeworkAnswer.value.trim();
        
        if (!answer && currentHomeworkFiles.length === 0) {
            elHomeworkMessage.textContent = "Введите ответ на задание или прикрепите файлы";
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

            // Отправляем домашнее задание
            const homeworkData = {
                theme_id: currentTheme.id,
                title: currentTheme.name || "Домашнее задание",
                text: answer,
                // Файлы уже загружены отдельно и связаны через theme_id
            };

            await apiFetch("/homeworks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(homeworkData)
            });

            elHomeworkMessage.textContent = "Домашнее задание отправлено на проверку!";
            elHomeworkMessage.className = "message-box message-success";
            
            // Очищаем поля
            elHomeworkAnswer.value = "";
            const filesInput = document.getElementById("hw-file");
            if (filesInput) filesInput.value = "";

            // Перезагружаем данные
            await loadHomeworkData(currentTheme.id);

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

// Получить токен из кук (если понадобится)
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

// Отметить тему как пройденную
async function markThemeAsCompleted(themeId) {
    try {
        await apiFetch(`/themes/${themeId}/mark-completed`, {
            method: "POST"
        });
        console.log(`Тема ${themeId} отмечена как пройденная`);
    } catch (e) {
        console.error('Ошибка отметки темы как пройденной:', e);
    }
}

// Загрузить прогресс по курсу
async function loadCourseProgress(courseId) {
    try {
        const progress = await apiFetch(`/courses/${courseId}/progress`);
        return progress;
    } catch (e) {
        console.error('Ошибка загрузки прогресса:', e);
        return null;
    }
}
