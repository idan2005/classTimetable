# Class Timetable (The "Only For Our Class" Edition)

Welcome to the **Class Timetable** project. This is an overly engineered solution to a simple problem: knowing exactly how many seconds are left until the next break.

> ⚠️ **Disclaimer:** This is a "troll project" strictly for internal use. If you are not in our class, this schedule will make absolutely no sense to you.

## 🌐 How to Use

**You do NOT need to run this locally.**

The app is live and hosted on GitHub Pages. Just go here:
👉 **[www.kobyking.com](http://www.kobyking.com)**

Open it on your phone, bookmark it, and wait for the bell.

## 🎯 Why does this exist?

* **To count down the suffering:** Precise timers for when the current lecture ends.
* **To track "BaseFood":** We know it's at Tzrifin 108, and we know we have to eat it.
* **Because looking at a PDF is too hard:** We built an entire cross-platform Angular app instead.

## 🤝 Contributing & Local Development

If you want to fix the schedule, add a feature, or just see how the sausage is made, you'll need to run the project locally.

1.  **Clone / Fork** the repository.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run the App:**
    ```bash
    ng serve
    ```
    Navigate to `http://localhost:4200/` to see your changes.
4.  **Make your changes.** (e.g., update `src/app/data/schedule.json` if we moved rooms).
5.  **Open a Pull Request (PR).** I'll review it and deploy the updates to the site.

## 🛠️ Tech Stack (The "Overkill" Section)

We used **Angular v20** and **Capacitor** for a simple timetable.

* **Framework:** Angular 20
* **Mobile:** Capacitor 7
* **UI:** PrimeNG

## 📄 License

**Unlicensed.** This code belongs to the class.
