const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 启用CORS支持
app.use(cors());

// 静态文件服务中间件
app.use(express.static('public'));

// 瓦片文件路由处理 - 支持标准瓦片URL格式 /{z}/{x}/{y}.png
app.get('/:z/:x/:y.:format', (req, res) => {
    const { z, x, y, format } = req.params;
    
    // 构建瓦片文件路径
    const tilePath = path.join(__dirname, 'tiles', z, x, `${y}.${format}`);
    
    console.log(`Requesting tile: ${z}/${x}/${y}.${format}`);
    console.log(`File path: ${tilePath}`);
    
    // 检查文件是否存在
    fs.access(tilePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`Tile not found: ${tilePath}`);
            // 返回404，或者返回一个默认的空瓦片
            res.status(404).json({ 
                error: 'Tile not found',
                path: `${z}/${x}/${y}.${format}`
            });
            return;
        }
        
        // 设置适当的Content-Type
        const contentType = getContentType(format);
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        // 设置缓存头
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        // 发送文件
        res.sendFile(tilePath, (err) => {
            if (err) {
                console.error(`Error sending file: ${err.message}`);
                res.status(500).json({ error: 'Error serving tile' });
            }
        });
    });
});

// 获取Content-Type
function getContentType(format) {
    const types = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
        'pbf': 'application/x-protobuf'
    };
    return types[format.toLowerCase()];
}

// 根路由 - 提供服务信息
app.get('/', (req, res) => {
    res.json({
        name: 'Local Tile Server',
        version: '1.0.0',
        description: 'Serving tiles from tiles/18 directory',
        usage: {
            tile_url: `http://localhost:${PORT}/{z}/{x}/{y}.{format}`,
            example: `http://localhost:${PORT}/18/131072/131072.png`,
            supported_formats: ['png', 'jpg', 'jpeg', 'webp']
        },
        available_zoom_levels: getAvailableZoomLevels()
    });
});

// 获取可用的缩放级别
function getAvailableZoomLevels() {
    const tilesDir = path.join(__dirname, 'tiles');
    try {
        const levels = fs.readdirSync(tilesDir)
            .filter(item => {
                const itemPath = path.join(tilesDir, item);
                return fs.statSync(itemPath).isDirectory();
            })
            .map(level => parseInt(level))
            .filter(level => !isNaN(level))
            .sort((a, b) => a - b);
        return levels;
    } catch (err) {
        console.error('Error reading tiles directory:', err);
        return [];
    }
}

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 获取瓦片目录信息
app.get('/tiles-info', (req, res) => {
    const tilesDir = path.join(__dirname, 'tiles');
    const info = {
        tiles_directory: tilesDir,
        available_levels: getAvailableZoomLevels(),
        structure: {}
    };
    
    // 获取每个级别的详细信息
    info.available_levels.forEach(level => {
        const levelDir = path.join(tilesDir, level.toString());
        try {
            const xDirs = fs.readdirSync(levelDir)
                .filter(item => {
                    const itemPath = path.join(levelDir, item);
                    return fs.statSync(itemPath).isDirectory();
                });
            
            info.structure[level] = {
                x_directories: xDirs.length,
                sample_x_dirs: xDirs// 只显示前5个作为示例
            };
        } catch (err) {
            info.structure[level] = { error: 'Cannot read directory' };
        }
    });
    
    res.json(info);
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        message: `Path ${req.path} not found`
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Tile server is running on http://localhost:${PORT}`);
    console.log(`📁 Serving tiles from: ${path.join(__dirname, 'tiles')}`);
    console.log(`🔗 Tile URL format: http://localhost:${PORT}/{z}/{x}/{y}.{format}`);
    console.log(`📊 Server info: http://localhost:${PORT}/`);
    console.log(`🔍 Tiles info: http://localhost:${PORT}/tiles-info`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n📴 Gracefully shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n📴 Gracefully shutting down...');
    process.exit(0);
});