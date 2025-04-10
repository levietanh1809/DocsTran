require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const i18n = require('./config/i18n');
const localeMiddleware = require('./middlewares/localeMiddleware');
const cookieParser = require('cookie-parser');
const app = express();
const session = require('express-session');

// database
const sequelize = require('./config/sequelize');

// Cấu hình middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Cấu hình view engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Thêm i18n middleware
app.use(i18n.init);

// Thêm locale middleware sau i18n
app.use(localeMiddleware);

// Import routes
const routes = require('./routes');

// Sử dụng routes
app.use('/', routes);

// Serve static files
app.use(express.static('src/public'));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

sequelize.authenticate()
  .then(() => {
    console.log('✅ Connected to MySQL');
    return sequelize.sync(); // { force: true } nếu muốn drop và tạo lại bảng
  })
  .then(() => {
    console.log('✅ Models synced');
  })
  .catch((err) => {
    console.error('❌ Unable to connect to DB:', err);
  });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});

// Xử lý lỗi không mong muốn
process.on('unhandledRejection', (error) => {
    console.error('Lỗi không mong muốn:', error);
    process.exit(1);
}); 