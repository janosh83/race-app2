const app = Vue.createApp({
    data() {
        return {
            menu: [
                { label: "Home", page: "home" },
                { label: "Races", page: "races" },
                { label: "Active Race", page: "activeRace" },
                { label: "Login", page: "login" },
                { label: "Logout", page: "logout" },
            ],
            currentPage: "home",
            races: [],
            signedRaces: [],
            activeRace: null, // Store the selected active race
            checkpoints: [], // Store checkpoints for the active race
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
    created() {
        const storedRaces = localStorage.getItem("signedRaces");
        if (storedRaces) {
            this.signedRaces = JSON.parse(storedRaces);
        }
    },
    methods: {
        selectPage(page) {
            this.currentPage = page;
            if (page === "activeRace" && this.activeRace) {
                this.loadCheckpoints();
            }
        },
        setActiveRace(race) {
            this.activeRace = race;
            console.log("Active race set to:", race);
            alert(`Active race set to: ${race.name}`);
        },
        async loadCheckpoints() {
            try {
                const token = localStorage.getItem("accessToken");
                if (!token) throw new Error("User is not logged in");
    
                const response = await fetch(`http://127.0.0.1:5000/api/race/${this.activeRace.race_id}/checkpoints/${this.activeRace.team_id}/status/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error("Failed to fetch checkpoints");
    
                this.checkpoints = await response.json();
            } catch (error) {
                console.error("Error loading checkpoints:", error);
            }
        },
        async logVisit(checkpoint) {
            try {
                const token = localStorage.getItem("accessToken");
                if (!token) throw new Error("User is not logged in");
    
                const response = await fetch(`http://127.0.0.1:5000/api/race/${this.activeRace.race_id}/checkpoints/log/`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ checkpoint_id: checkpoint.id, team_id: this.activeRace.team_id }),
                });
                if (!response.ok) throw new Error("Failed to log visit");
    
                alert(`Visit logged for checkpoint: ${checkpoint.title}`);
                this.loadCheckpoints(); // Refresh the checkpoints
            } catch (error) {
                console.error("Error logging visit:", error);
            }
        },
        async unlogVisit(checkpoint) {
            try {
                const token = localStorage.getItem("accessToken");
                if (!token) throw new Error("User is not logged in");
        
                const response = await fetch(`http://127.0.0.1:5000/api/race/${this.activeRace.race_id}/checkpoints/log/`,{
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ checkpoint_id: checkpoint.id, team_id: this.activeRace.team_id }),
                    }
                );
                if (!response.ok) throw new Error("Failed to unlog visit");
        
                alert(`Visit unlogged for checkpoint: ${checkpoint.title}`);
                this.loadCheckpoints(); // Refresh the checkpoints
            } catch (error) {
                console.error("Error unlogging visit:", error);
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
                localStorage.setItem("signedRaces", JSON.stringify(data.signed_races));

                this.signedRaces = data.signed_races;
        
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