const BASE_URL = "https://merely-factual-platy.cloudpub.ru"; // Поменяйте под ваш хост

// Переключение между формами
function showLogin() {
    document.getElementById("register-block").style.display = "none";
    document.getElementById("login-block").style.display = "block";
}

function showRegister() {
    document.getElementById("login-block").style.display = "none";
    document.getElementById("register-block").style.display = "block";
}

// ---------------------- РЕГИСТРАЦИЯ -------------------------
async function registerUser() {
    const full_name = document.getElementById("reg-fullname").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value.trim();
    const is_teacher = document.getElementById("reg-is-teacher").checked;

    const messageBox = document.getElementById("register-message");
    messageBox.textContent = "";

    if (!full_name || !email || !password) {
        messageBox.textContent = "Заполните все поля";
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password,
                full_name,
                is_teacher
            })
        });

        if (!res.ok) {
            const err = await res.json();
            messageBox.textContent = err.detail || "Ошибка регистрации";
            return;
        }

        messageBox.style.color = "green";
        messageBox.textContent = "Регистрация успешна! Теперь войдите.";

        setTimeout(showLogin, 1000);

    } catch (e) {
        messageBox.textContent = "Ошибка подключения к серверу";
    }
}



// ---------------------- ЛОГИН -------------------------
async function loginUser() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const messageBox = document.getElementById("login-message");
    messageBox.textContent = "";

    if (!email || !password) {
        messageBox.textContent = "Введите email и пароль";
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            credentials: "include", // <---- важно для куки с токеном!
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            messageBox.textContent = data.detail || "Ошибка входа";
            return;
        }

        messageBox.style.color = "green";
        messageBox.textContent = "Успешный вход!";

        // Получаем информацию о пользователе чтобы узнать его роль
        const profileRes = await fetch(`${BASE_URL}/auth/me`, {
            credentials: "include"
        });
        
        if (profileRes.ok) {
            const userData = await profileRes.json();
            
            // Перенаправление в зависимости от роли
            if (userData.is_teacher) {
                window.location.href = "/front/templates/teacher.html";
            } else {
                window.location.href = "/front/templates/student.html";
            }
        }

    } catch (e) {
        messageBox.textContent = "Ошибка подключения к серверу";
    }
}