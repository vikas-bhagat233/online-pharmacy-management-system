# Deployment Guide

## 1. Prepare for Deployment

### A. Push to GitHub
1. Create a new repository on GitHub.
2. Push your entire project folder (`online-pharmacy-management-system`) to this repository.

## 2. Deploy Backend (Render.com)

1. **Sign up/Login** to [Render](https://render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. **Configuration**:
   - **Root Directory**: `backend` (This is important!)
   - **Name**: Choose a name (e.g., `pharmacy-backend`).
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. **Environment Variables** (Copy these from your local `backend/.env` file):
   - `MONGODB_URI`: Your MongoDB connection string.
   - `JWT_SECRET`: Your secret key.
   - `RAZORPAY_KEY_ID`: Your Key ID.
   - `RAZORPAY_KEY_SECRET`: Your Secret.
   - `EMAIL_USER`: Your email address.
   - `EMAIL_PASS`: Your email app password.
   - `ADMIN_NOTIFY_EMAIL`: Admin email.
   - `CLOUDINARY_...`: Your Cloudinary keys.
6. Click **Create Web Service**.
7. **Wait** for the deployment to finish.
8. **Copy the URL** provided by Render (e.g., `https://pharmacy-backend.onrender.com`). You will need this for the frontend steps.

## 3. Deploy Frontend (Netlify)

1. **Sign up/Login** to [Netlify](https://www.netlify.com/).
2. **Update Config**:
   - Open `frontend/public/js/config.js` in your code editor.
   - Replace `'https://YOUR_BACKEND_APP_NAME.onrender.com'` with your **actual Render Backend URL** from the previous step.
   - Save the file and commit/push the change to GitHub (optional but recommended).
3. **Deploy from GitHub** (Recommended for updates):
   - Click **Add new site** -> **Import from Map**.
   - Connect GitHub and select your repository.
   - **Base directory**: `frontend`
   - **Publish directory**: `frontend` (or leave blank if it auto-detects)
   - Click **Deploy**.
4. **OR Drag & Drop**:
   - Go to "Sites" in Netlify.
   - Drag your `frontend` folder onto the drop zone.

## 4. Final Verification

1. Open your new Netlify URL (e.g., `https://my-pharmacy.netlify.app/pages/index.html`).
2. Try to **Login/Register**. Check if it connects to the backend.
3. If it fails, check the **Browser Console (F12)**. If you see "Network Error" or 404s, double-check that you updated `config.js` with the correct Render URL.
