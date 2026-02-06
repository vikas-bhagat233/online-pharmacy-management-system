# Online Pharmacy Management System (MediCare)

A comprehensive full-stack web application for managing an online pharmacy. This system allows users to browse medicines, manage their cart, place orders, and track deliveries. It also provides a powerful admin dashboard for inventory management, order processing, and sales analytics.

## 🚀 Features

### For Users
*   **Browse & Search**: Extensive catalog of medicines with categories and search functionality.
*   **User Accounts**: Secure registration and login.
*   **Shopping Cart**: Add to cart, update quantities, and seamless checkout.
*   **Payments**: 
    *   Cash on Delivery (COD)
    *   Online Payments (Integrated with **Razorpay**)
*   **Order Tracking**: Real-time status updates (Placed -> Confirmed -> Shipped -> Out for Delivery -> Delivered).
*   **Invoices**: Auto-generated PDF invoices for all orders.
*   **Email Notifications**: Instant email alerts for orders, payments, and status changes.

### For Admins
*   **Dashboard**: Overview of total sales, orders, and low-stock alerts.
*   **Inventory Management**: Add, update, and remove medicines. Image upload support (Cloudinary).
*   **Order Management**: View all orders, update statuses, and assign delivery agents.
*   **User Management**: View customer details.

## 🛠️ Tech Stack

*   **Frontend**: HTML5, CSS3 (Modern/Responsive), Vanilla JavaScript.
*   **Backend**: Node.js, Express.js.
*   **Database**: MongoDB (Mongoose ODM).
*   **Authentication**: JWT (JSON Web Tokens).
*   **Payment Gateway**: Razorpay.
*   **Email Service**: Resend API.
*   **Image Storage**: Cloudinary.
*   **Deployment**: Render (Backend), Netlify (Frontend).

## ⚙️ Installation & Setup

### Prerequisites
*   Node.js (v14+)
*   MongoDB (Local or Atlas)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/online-pharmacy-management-system.git
cd online-pharmacy-management-system
```

### 2. Backend Setup
Navigate to the backend folder and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key

# Payment (Razorpay)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Image Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
ADMIN_EMAIL=admin@pharmacy.com
ADMIN_NOTIFY_EMAIL=your_email@gmail.com
BACKEND_PUBLIC_URL=http://localhost:5000
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
Navigate to the frontend folder. No `npm install` is required as it uses vanilla JS, but you need a static server to run it properly.

Update Configuration:
*   Edit `frontend/public/js/config.js` if necessary to point to your backend URL (defaults to auto-detect).

Run using a static server (e.g., Live Server or Python):
```bash
cd frontend
# If using Python
python -m http.server 3000
```
Open `http://localhost:3000` in your browser.

## 📦 Deployment

### Backend (Render)
1.  Push code to GitHub.
2.  Create a "Web Service" on [Render](https://render.com).
3.  Connect your repo.
4.  Set `Root Directory` to `backend`.
5.  Set `Build Command` to `npm install`.
6.  Set `Start Command` to `node server.js`.
7.  Add all Environment Variables from your `.env` file in the Render Dashboard.

### Frontend (Netlify)
1.  Create a new site on [Netlify](https://netlify.com).
2.  Connect your repo.
3.  Set `Base Directory` to `frontend`.
4.  Set `Publish Directory` to `frontend` (or `frontend/pages` if you want a specific root).
5.  Deploy.

## 🛡️ API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/medicines` | Get all medicines (pagination support) |
| POST | `/api/orders/checkout` | Place a new order |
| GET | `/api/orders/my-orders` | Get user order history |
| POST | `/api/payments/verify` | Verify Razorpay payment |

## 🤝 Contributing

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License.
