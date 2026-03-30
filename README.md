# BOLT (雷电) — 2.5D 现代化弹幕射击游戏

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Tech](https://img.shields.io/badge/Core-Three.js-orange)
![Build](https://img.shields.io/badge/Build-Vite-646CFF)

**BOLT (雷电)** 是一款基于 Three.js 开发的 2.5D 现代化弹幕射击游戏（SHMUP）。它在致敬经典街机《雷电 II》的基础上，利用现代 Web 技术实现了高清 3D 渲染、动态光影、复杂的粒子特效以及智能转向的导弹系统。

---

## 🚀 核心特性

- **2.5D 视觉艺术**：利用 Three.js 透视相机与倾斜视角，打造具有深度感的垂直卷轴战场。
- **现代化渲染**：
  - **后期处理**：集成 Bloom（辉光）特效，使激光和爆炸更加夺目。
  - **动态背景**：多层视差滚动，包括程序化生成的海洋着色器（Ocean Shader）和动态云层。
- **丰富的武器系统**：
  - **红武器 (Vulcan)**：高覆盖范围的火神炮。
  - **蓝武器 (Laser)**：高伤害的贯穿激光。
  - **紫武器 (Homing)**：自动锁定目标的诱导激光。
  - **核爆炸弹 (Bomb)**：经典的清屏大招。
- **智能敌人系统**：
  - 多达 20+ 种敌人，从侦察机到重型坦克和导弹发射井。
  - **跟踪导弹**：特定的敌方单位能发射具有智能转向能力的 3D 火箭导弹。
- **史诗级 Boss 战**：三阶段变换的 Boss，拥有标志性的华丽弹幕（如花形弹幕、旋转环形弹）。
- **全平台适配**：完美支持 PC（键盘/鼠标）以及移动端（触摸操作）。

---

## 🛠️ 技术栈

- **引擎**: [Three.js](https://threejs.org/) (WebGL/WebGPU)
- **后期处理**: [postprocessing](https://github.com/vanruesc/postprocessing)
- **构建工具**: [Vite](https://vitejs.dev/)
- **编程语言**: [TypeScript](https://www.typescriptlang.org/)
- **UI**: 原生 HTML5 / CSS3 (具有玻璃拟态效果)

---

## 🎮 操作说明

### PC 端 (键盘)
- **移动**: `W` `A` `S` `D` 或 `方向键`
- **慢速模式**: 按住 `Left Shift`
- **射击**: `J` 或 `Space`
- **释放炸弹**: `K` 或 `B`
- **切换武器**: `1` (火神炮) / `2` (激光) / `3` (诱导激光)

### PC 端 (鼠标)
- **移动/射击**: 按住鼠标左键并拖动
- **释放炸弹**: 鼠标右键

### 移动端 (触摸)
- **移动/射击**: 单指点击并拖动控制飞船
- **释放炸弹**: 双击屏幕或点击 UI 按钮

---

## 📦 安装与开发

### 环境要求
- Node.js (推荐 v18+)
- npm 或 yarn

### 获取项目
```bash
git clone https://github.com/ruanqizhen/bolt.git
cd bolt
```

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

---

## 📂 项目结构

- `src/core/`: 核心引擎逻辑（渲染器、场景管理、相机控制）。
- `src/game/`: 游戏逻辑（玩家、敌人、Boss、导弹、关卡解析等）。
- `src/systems/`: 通用系统（碰撞检测、粒子系统、音频、输入、资源管理）。
- `src/assets/`: 游戏配置 (JSON) 与静态资源。
- `src/styles/`: CSS 样式表。

---

## 📜 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🌐 开发者

**Qizhen (ruanqizhen)**  
访问我：[https://qizhen.xyz/](https://qizhen.xyz/)
