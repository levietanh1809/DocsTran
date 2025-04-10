const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const History = sequelize.define('History', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  projectName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sheetUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sheetName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sheetRange: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  targetLang: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customPrompt: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  totalCells: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Số ô đã dịch'
  },
  totalChars: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Tổng số ký tự đã dịch'
  },
  estimatedCost: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    comment: 'Chi phí ước tính tổng'
  },
  inputTokens: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Số token đầu vào'
  },
  outputTokens: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Số token đầu ra'
  },
  inputCost: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    comment: 'Chi phí token đầu vào'
  },
  outputCost: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    comment: 'Chi phí token đầu ra'
  },
  inputRate: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Chi phí token đầu vào pricing'
  },
  outputRate: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Chi phí token đầu ra pricing'
  }
}, {
  tableName: 'histories',
  timestamps: true,
});

module.exports = History;