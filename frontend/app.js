const app = Vue.createApp({
    data() {
        return {
            menu: [
                { label: "Home", page: "home" },
                { label: "Races", page: "races" },
                { label: "Teams", page: "teams" },
                { label: "Users", page: "users" },
                { label: "Login", page: "login" },
                { label: "Logout", page: "logout" },
            ],
            currentPage: "home",
            races: [],
            email: "",
            password: "",
            loginError: "",
        };
    },
    computed: {
        isAuthenticated() {
            return !!localStorage.getItem("accessToken");
        },
        filteredMenu() {
            return this.menu.filter(item => {
                if (item.page === "login") return !this.isAuthenticated;
                if (item.page === "logout") return this.isAuthenticated;
                return this.isAuthenticated;
            });
        },
    },
    methods: {
        selectPage(page) {
            this.currentPage = page;
        },
        async loadRaces() {
            try {
                const token = localStorage.getItem("accessToken");
                if (!token) throw new Error("User is not logged in");
        
                const response = await fetch("http://127.0.0.1:5000/api/race/", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to fetch races");
        
                this.races = await response.json();
            } catch (error) {
                console.error("Error loading races:", error);
            }
        },
        async login() {
            try {
                const response = await fetch("http://127.0.0.1:5000/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: this.email, password: this.password }),
                });
                if (!response.ok) throw new Error("Invalid email or password");
        
                const data = await response.json();
                console.log("Login successful:", data);
        
                // Store the access token in localStorage
                localStorage.setItem("accessToken", data.access_token);
        
                this.loginError = "";
                this.selectPage("home"); // Redirect to home after login
                window.location.reload();
            } catch (error) {
                this.loginError = "Invalid email or password.";
                console.error("Login error:", error);
            }
        },
        logout() {
            console.log("Logout method called");
            // Clear the access token from localStorage
            localStorage.removeItem("accessToken");
            console.log("isAuthenticated:", this.isAuthenticated);
        
            // Redirect to the login page
            this.selectPage("login");
            window.location.reload();
        }
    },
});

app.mount("#app");