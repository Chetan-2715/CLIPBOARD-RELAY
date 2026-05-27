# Secure Ephemeral Clipboard & File Relay

A real-time, high-performance clipboard and file relay application built with **React (Vite) + Tailwind CSS v4 + Express + Socket.io**. 

Designed for shared workstation environments (such as college labs or offices), this app allows you to share text/code formatting and files securely between devices (e.g., PC to phone) using a 6-character room code. 

All sessions have a strict **15-minute Time-To-Live (TTL)** in Redis, which is renewed automatically with each sync. A manual **"Wipe Data"** button lets you clear all keys from Upstash Redis immediately before leaving a machine.

---

## 🚀 Step-by-Step Setup Guide

Follow these steps to set up your accounts, retrieve the connection keys, and run the project.

### 1. Set Up Upstash Redis (Serverless)

Upstash offers a completely serverless Redis database with a generous free tier (10k requests/day).

1. Go to [Upstash Console](https://console.upstash.com) and sign up/log in.
2. Click **Create Database**.
3. Enter a database name (e.g., `ephemeral-clipboard`) and select a region close to you.
4. Keep the defaults and click **Create**.
5. Scroll down to the **REST API** section of your database dashboard.
6. Copy the following keys:
   - **`UPSTASH_REDIS_REST_URL`**
   - **`UPSTASH_REDIS_REST_TOKEN`**

---

### 2. Set Up Cloudinary (File Storage)

Cloudinary handles cloud image and file hosting with a generous free tier.

1. Go to [Cloudinary](https://cloudinary.com) and sign up for a free account.
2. Log in and go to your **Dashboard**.
3. Under the **Product Environment Credentials** section, you will see your credentials:
   - **Cloud Name** (`CLOUDINARY_CLOUD_NAME`)
   - **API Key** (`CLOUDINARY_API_KEY`)
   - **API Secret** (`CLOUDINARY_API_SECRET` - click "View" to reveal)

---

### 3. Environment Configuration

1. In the `backend` folder, create a file named `.env`:
   ```bash
   # In d:\P2L TRANSFER\backend
   touch .env
   ```
2. Copy the content from `.env.example` into `.env` and fill in your keys:
   ```env
   PORT=3000
   ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,*

   UPSTASH_REDIS_REST_URL=https://your-database-name.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here

   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```
   
> [!CAUTION]
> **Security Note:** Never commit your `.env` file to git. It is already added to the backend `.gitignore`.

---

### 4. Running the Application

You will need two terminals to run the backend and frontend concurrently.

#### Start the Backend (Terminal 1)
```bash
cd backend
npm run dev
```
*The server will start on `http://localhost:3000`.*

#### Start the Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
*Vite will start the client, usually on `http://localhost:5173`.*

---

## 📱 Connecting Your Phone (Local Network Sharing)

To share files/text between your PC and a mobile device:

1. **Find your PC's local IP address:**
   - On Windows (PowerShell): Run `ipconfig` and look for `IPv4 Address` under your active network adapter (e.g., `192.168.1.15`).
   - On Mac/Linux: Run `ifconfig` or `ip a`.
2. **Open the App on your Phone:**
   - Open your mobile browser and navigate to `http://<your-pc-ip>:5173/` (e.g., `http://192.168.1.15:5173/`).
3. **Allow network connection in .env:**
   - Make sure `ALLOWED_ORIGINS` in your `backend/.env` has `*` or includes `http://<your-pc-ip>:5173` so your phone doesn't get blocked by CORS. (By default, the wildcard `*` is configured in our `.env.example` for friction-free local setup).
4. **Scan & Go:**
   - Generate a room on your PC.
   - Click **"Scan with Mobile Device"** on your PC dashboard to display the QR code.
   - Scan it with your phone to instantly sync the clipboard session!

---

## 🎨 Application Features & Tech Highlights

- **Text Indentation Preservation:** Uses styled `<pre>` blocks on the frontend to preserve exact spaces, indentations, and newlines (ideal for copying programming code snippets).
- **Interactive Confetti Alerts:** Built-in bursts of confetti celebrate successful data synchronization and clipboard copying.
- **Glassmorphism Theme:** Futuristic dark UI with neon-violet and deep-pink glowing states using the brand-new Tailwind CSS v4.
- **Real-Time Rooms:** Instant syncing using Socket.io room events. Phone changes reflect instantly on the desktop, and vice versa.
- **Immediate Data Destruction:** Clicking **Wipe Data** deletes the key from Upstash Redis immediately and sends a broadcast event that disconnects and wipes the interface state of all active users in the room.
