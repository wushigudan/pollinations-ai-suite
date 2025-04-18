// DOM Elements
const promptInput = document.querySelector('.prompt-input');
const sizeSelect = document.getElementById('sizeSelect');
const customSizeDiv = document.getElementById('customSize');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const generateBtn = document.getElementById('generateBtn');
const compareBtn = document.getElementById('compareBtn');
const resultContainer = document.getElementById('result');
const seedInput = document.getElementById('seedInput');
const randomSeedBtn = document.getElementById('randomSeedBtn');

// 常量定义
const MAX_WIDTH = 1704;
const MAX_HEIGHT = 960;
const API_DELAY = 1000; // 请求间隔1秒

// 提示词模板
const PROMPT_TEMPLATES = [
    'A beautiful landscape with mountains and a lake at sunset',
    'A futuristic city skyline with flying cars and neon lights',
    'A magical forest with glowing butterflies and fairy lights',
    'An ancient temple covered in vines under moonlight',
    'A cozy cafe interior with warm lighting and vintage decorations',
    'A cyberpunk street scene with rain and reflections',
    'A serene Japanese garden with cherry blossoms',
    'An underwater scene with colorful coral reefs and fish',
    'A steampunk laboratory with complex machinery',
    'A fantasy castle floating in the clouds'
];

// 支持的模型列表
const MODELS = [
    { id: 'flux', name: 'Flux' },
    { id: 'flux-pro', name: 'Flux Pro' },
    { id: 'sdxl', name: 'SDXL' },
    { id: 'kandinsky', name: 'Kandinsky' },
    { id: 'playground', name: 'Playground' }
];

// Size presets mapping
const sizePresets = {
    '标准 (1024x1024)': [1024, 1024],
    '横向 (1280x720)': [1280, 720],
    '纵向 (720x1280)': [720, 1280],
    '最大尺寸 (1704x960)': [1704, 960],
    '自定义尺寸': [0, 0]
};

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 生成随机提示词
function randomPrompt() {
    const index = Math.floor(Math.random() * PROMPT_TEMPLATES.length);
    promptInput.value = PROMPT_TEMPLATES[index];
}

// 清除提示词
function clearPrompt() {
    promptInput.value = '';
    promptInput.focus();
}

// 生成随机种子
function generateRandomSeed() {
    const seed = Math.floor(Math.random() * 999999) + 1;
    seedInput.value = seed;
    return seed;
}

// 获取当前种子
function getCurrentSeed() {
    let seed = parseInt(seedInput.value);
    if (!seed || isNaN(seed)) {
        seed = generateRandomSeed();
    }
    return seed;
}

// 创建图片卡片
function createImageCard(model, imageUrl, seed, width, height) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    const thumbnail = document.createElement('img');
    thumbnail.src = imageUrl;
    thumbnail.alt = `${model.name} generated image`;
    thumbnail.className = 'thumbnail';
    
    const info = document.createElement('div');
    info.className = 'model-info';
    info.textContent = model.name;
    
    // 点击查看大图
    thumbnail.onclick = () => {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        
        const modalImg = document.createElement('img');
        modalImg.src = imageUrl;
        modalImg.alt = `${model.name} generated image`;
        modalImg.crossOrigin = "anonymous";  // 添加跨域支持
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => modal.remove();
        
        const modalInfo = document.createElement('div');
        modalInfo.className = 'modal-info';
        modalInfo.innerHTML = `
            <p>模型: ${model.name}</p>
            <p>尺寸: ${width}x${height}</p>
            <p>种子: ${seed}</p>
        `;
        
        // 添加下载按钮
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'modal-download';
        downloadBtn.textContent = '下载图片';
        downloadBtn.onclick = async () => {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `generated-${model.name}-${width}x${height}-seed${seed}.png`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (error) {
                console.error('Error downloading image:', error);
                alert('下载图片时出错，请重试');
            }
        };
        
        modal.appendChild(modalImg);
        modal.appendChild(closeBtn);
        modal.appendChild(modalInfo);
        modal.appendChild(downloadBtn);
        document.body.appendChild(modal);
        
        // 点击模态框外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    };
    
    card.appendChild(thumbnail);
    card.appendChild(info);
    return card;
}

// 生成单个图片
async function generateSingleImage(model, prompt, width, height, seed) {
    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
        width: width,
        height: height,
        seed: seed,
        model: model.id,
        nologo: 'true'
    });
    
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;
    return { model, url, seed, width, height };
}

// 获取图片尺寸
function getImageSize() {
    if (sizeSelect.value === '自定义尺寸') {
        let width = parseInt(widthInput.value);
        let height = parseInt(heightInput.value);
        
        // 确保不超过API限制
        if (width > MAX_WIDTH) {
            width = MAX_WIDTH;
            widthInput.value = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
            height = MAX_HEIGHT;
            heightInput.value = MAX_HEIGHT;
        }
        
        if (!width || !height || width < 64 || height < 64) {
            throw new Error('请输入有效的图像尺寸（64-1704像素）');
        }
        return [width, height];
    }

    // 从预设中获取尺寸
    const sizeKey = sizeSelect.value;
    const preset = sizePresets[sizeKey];
    if (!preset) {
        throw new Error('请选择有效的图像尺寸');
    }

    // 确保不超过API限制
    let [width, height] = preset;
    if (width > MAX_WIDTH) width = MAX_WIDTH;
    if (height > MAX_HEIGHT) height = MAX_HEIGHT;
    
    return [width, height];
}

// 创建进度指示器
function createProgressIndicator() {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    
    const progressHeader = document.createElement('div');
    progressHeader.className = 'progress-header';
    progressHeader.textContent = '生成进度';
    
    const progressList = document.createElement('div');
    progressList.className = 'progress-list';
    
    MODELS.forEach(model => {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
            <span class="model-name">${model.name}</span>
            <span class="status pending">等待中</span>
        `;
        progressList.appendChild(progressItem);
    });
    
    progressContainer.appendChild(progressHeader);
    progressContainer.appendChild(progressList);
    return progressContainer;
}

// 更新进度状态
function updateProgress(model, status, error = null) {
    const progressList = document.querySelector('.progress-list');
    if (!progressList) return;
    
    const progressItem = progressList.children[[...MODELS].findIndex(m => m.id === model.id)];
    if (!progressItem) return;
    
    const statusSpan = progressItem.querySelector('.status');
    statusSpan.className = `status ${status}`;
    
    switch (status) {
        case 'pending':
            statusSpan.textContent = '等待中';
            break;
        case 'generating':
            statusSpan.textContent = '生成中...';
            break;
        case 'success':
            statusSpan.textContent = '完成';
            break;
        case 'error':
            statusSpan.textContent = error || '失败';
            statusSpan.title = error || '生成失败';
            break;
    }
}

// 生成所有模型的图片
async function generateAllImages() {
    if (!promptInput.value.trim()) {
        alert('请输入提示词');
        return;
    }

    // Update UI - Loading state
    generateBtn.disabled = true;
    compareBtn.disabled = true;
    generateBtn.textContent = '生成中...';
    resultContainer.innerHTML = '';
    
    // 创建进度指示器
    const progressIndicator = createProgressIndicator();
    resultContainer.appendChild(progressIndicator);
    
    try {
        const [width, height] = getImageSize();
        const seed = getCurrentSeed();
        const prompt = promptInput.value.trim();
        
        // 创建瀑布流容器
        const masonryContainer = document.createElement('div');
        masonryContainer.className = 'masonry-grid';
        resultContainer.appendChild(masonryContainer);
        
        // 依次生成每个模型的图片
        for (const model of MODELS) {
            try {
                updateProgress(model, 'generating');
                const { url } = await generateSingleImage(model, prompt, width, height, seed);
                const card = createImageCard(model, url, seed, width, height);
                masonryContainer.appendChild(card);
                updateProgress(model, 'success');
                
                // 添加请求间隔
                await delay(API_DELAY);
            } catch (error) {
                console.error(`Error generating image for ${model.name}:`, error);
                updateProgress(model, 'error', error.message);
                // 继续生成其他模型的图片
            }
        }
    } catch (error) {
        console.error('Error generating images:', error);
        alert(error.message || '生成图片时出错，请重试');
    } finally {
        // Reset UI
        generateBtn.disabled = false;
        compareBtn.disabled = false;
        generateBtn.textContent = '生成';
    }
}

// 生成单个模型的图片
async function generateSingleModelImage() {
    if (!promptInput.value.trim()) {
        alert('请输入提示词');
        return;
    }

    // Update UI - Loading state
    generateBtn.disabled = true;
    compareBtn.disabled = true;
    generateBtn.textContent = '生成中...';
    resultContainer.innerHTML = '';
    
    // 创建进度指示器
    const progressIndicator = createProgressIndicator();
    resultContainer.appendChild(progressIndicator);
    
    try {
        const [width, height] = getImageSize();
        const seed = getCurrentSeed();
        const prompt = promptInput.value.trim();
        const selectedModel = MODELS[0]; // 默认使用第一个模型
        
        updateProgress(selectedModel, 'generating');
        const { url } = await generateSingleImage(selectedModel, prompt, width, height, seed);
        
        // 创建结果容器
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'result-wrapper';
        
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Generated image';
        img.crossOrigin = "anonymous";
        
        // 添加图片信息
        const infoDiv = document.createElement('div');
        infoDiv.className = 'image-info';
        infoDiv.innerHTML = `
            <p>模型: ${selectedModel.name}</p>
            <p>尺寸: ${width}x${height}</p>
            <p>种子: ${seed}</p>
        `;
        
        imgWrapper.appendChild(img);
        imgWrapper.appendChild(infoDiv);
        
        // Clear previous results
        resultContainer.innerHTML = '';
        resultContainer.appendChild(imgWrapper);
        
        updateProgress(selectedModel, 'success');
        
        // Scroll to result
        resultContainer.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error generating image:', error);
        updateProgress(selectedModel, 'error', error.message);
        alert(error.message || '生成图片时出错，请重试');
    } finally {
        // Reset UI
        generateBtn.disabled = false;
        compareBtn.disabled = false;
        generateBtn.textContent = '生成';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // 初始化种子输入
    generateRandomSeed();
    
    // 随机种子按钮事件
    randomSeedBtn.addEventListener('click', generateRandomSeed);
    
    // 初始化尺寸选择下拉框
    sizeSelect.innerHTML = '';
    Object.keys(sizePresets).forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        sizeSelect.appendChild(option);
    });

    // Handle size selection change
    sizeSelect.addEventListener('change', () => {
        if (sizeSelect.value === '自定义尺寸') {
            customSizeDiv.classList.remove('hidden');
            widthInput.placeholder = `最大 ${MAX_WIDTH}`;
            heightInput.placeholder = `最大 ${MAX_HEIGHT}`;
        } else {
            customSizeDiv.classList.add('hidden');
            const [width, height] = sizePresets[sizeSelect.value];
            widthInput.value = width;
            heightInput.value = height;
        }
    });

    // Validate size inputs
    function validateSize(input, maxSize) {
        let value = parseInt(input.value);
        if (value < 64) value = 64;
        if (value > maxSize) value = maxSize;
        input.value = value;
    }

    widthInput.addEventListener('change', () => validateSize(widthInput, MAX_WIDTH));
    heightInput.addEventListener('change', () => validateSize(heightInput, MAX_HEIGHT));

    // 添加尺寸限制提示
    const sizeNote = document.createElement('div');
    sizeNote.className = 'size-note';
    sizeNote.innerHTML = `<small>注意：图片最大尺寸限制为 ${MAX_WIDTH}x${MAX_HEIGHT} 像素</small>`;
    customSizeDiv.appendChild(sizeNote);

    // Handle enter key in textarea
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateSingleModelImage();
        }
    });

    // 修改生成按钮事件
    generateBtn.onclick = generateSingleModelImage;
    compareBtn.onclick = generateAllImages;
}); 