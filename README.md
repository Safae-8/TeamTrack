# TeamTrack ⚽

A Full-Stack Football Team Management Application

TeamTrack is a web-based application designed to help football teams organize and manage their daily activities, including player information, training sessions, attendance, excuses, and team-related records.

The project is being developed to simplify team administration and provide a centralized platform for managing team activities.

> Project Status: Work in Progress 🚧

## Features

The application currently includes modules for:

- Player Management – Manage player information and profiles.
- Training Sessions – Organize and manage training sessions.
- Training Schedule – Manage recurring training schedules.
- Attendance Management – Record and manage player attendance.
- Excuse Management – Submit and review attendance excuses.
- Fines Management – Manage team fines.
- Monthly Reports – View monthly team reports.
- Settings – Manage application settings.

*Features and functionality are still being developed and improved.*

## Technologies Used

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- MySQL

### Other Tools
- Git and GitHub
- npm

## Project Structure


TeamTrack/
│
├── Backend/
│   ├── API routes/
│   ├── db.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── Frontend/
│   ├── components/
│   ├── css/
│   ├── images/
│   ├── js/
│   └── *.html
│
├── .gitignore
└── README.md


## Getting Started

## Prerequisites

Make sure you have installed:

- Node.js and npm
- MySQL
- Git

1. Clone the repository


git clone https://github.com/Safae-8/TeamTrack.git
cd TeamTrack


2. Install backend dependencies


cd Backend
npm install


3. Configure environment variables

Create a `.env` file inside the `Backend` folder using `.env.example` as a template.

Configure your local MySQL connection:


DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=teamtrack
DB_PORT=3306
PORT=3000


4. Configure the database

Create a MySQL database named `teamtrack` and ensure the required application tables are available.

Note: A database schema/setup SQL file is not included in the repository yet.

5. Start the application

From the `Backend` directory, run:


npm start


Open the application in your browser:


http://localhost:3000


## Development

TeamTrack is an ongoing project. New features, improvements, and refinements will be added as development progresses.

## Author

Safae Benboubadi

GitHub: [@Safae-8](https://github.com/Safae-8)

---

*Built as a full-stack software development project.*