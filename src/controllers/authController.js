const bcrypt = require('bcrypt');
const User = require('../models/User');

const login = async (req, res) => {
  const { email, password } = req.body;
  const errors = [];

  try {
    // Tìm user theo email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      errors.push({ msg: 'Tài khoản chưa được đăng ký' });
      return res.render('login', {
        title: 'Đăng nhập',
        errors,
        old: { email }
      });
    }

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      errors.push({ msg: 'Email hoặc mật khẩu không đúng' });
      return res.render('login', {
        title: 'Đăng nhập',
        errors,
        old: { email }
      });
    }

    // Lưu session khi đăng nhập thành công
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.username
    };

    return res.redirect('/translate');
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    return res.render('login', {
      title: 'Đăng nhập',
      errors: [{ msg: 'Đã xảy ra lỗi máy chủ, vui lòng thử lại sau.' }],
      old: { email }
    });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

module.exports = {
  login,
  logout
};
