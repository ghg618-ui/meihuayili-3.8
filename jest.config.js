module.exports = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    '**/test-*.js',
    '**/__tests__/**/*.js'
  ],
  
  // 转换配置（如果需要 Babel）
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 覆盖率报告配置
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/main.js',
    '!src/index.css',
  ],
  
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  //  verbose 输出
  verbose: true,
  
  // 测试超时时间（毫秒）
  testTimeout: 10000,
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  cacheDirectory: './.jest_cache'
};
