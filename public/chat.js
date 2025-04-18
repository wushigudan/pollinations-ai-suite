// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const modelSelect = document.getElementById('modelSelect');
const clearButton = document.getElementById('clearButton');

// Constants
const BASE_API_URL = 'https://text.pollinations.ai';
const MODELS_URL = 'https://text.pollinations.ai/models';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const REQUEST_INTERVAL = 3000; // 3秒间隔限制
const REQUEST_TIMEOUT = 60000; // 60秒超时

// State
let isGenerating = false;
let controller = null;
let messageQueue = [];
let lastRequestTime = 0;
let conversationHistory = [];
let currentModel = null;

// 加载可用模型
async function loadAvailableModels() {
    try {
        const response = await fetch(MODELS_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const models = await response.json();
        
        // 清空现有选项
        modelSelect.innerHTML = '';
        
        // 创建模型分组
        const groups = {
            general: '通用模型 🤖',
            vision: '视觉模型 👁️',
            multimodal: '多模态模型 🎯',
            reasoning: '推理增强模型 🧠',
            coding: '编程模型 💻',
            special: '特殊用途 🔧'
        };

        // 创建分组选项组
        const modelGroups = {
            general: [],
            vision: [],
            multimodal: [],
            reasoning: [],
            coding: [],
            special: []
        };

        // 对模型进行分类
        models.forEach(model => {
            const modelOption = {
                id: model.name,
                name: `${model.name} - ${model.description}`,
                description: `提供商: ${model.provider}`
            };

            // 根据模型特性进行分组
            if (model.name.includes('coder') || model.description.toLowerCase().includes('code')) {
                modelGroups.coding.push(modelOption);
            } else if (model.reasoning) {
                modelGroups.reasoning.push(modelOption);
            } else if (model.input_modalities.includes('image') && model.input_modalities.includes('audio')) {
                modelGroups.multimodal.push(modelOption);
            } else if (model.vision || model.input_modalities.includes('image')) {
                modelGroups.vision.push(modelOption);
            } else if (['midijourney', 'rtist', 'hypnosis-tracy'].includes(model.name)) {
                modelGroups.special.push(modelOption);
            } else {
                modelGroups.general.push(modelOption);
            }
        });

        // 添加分组到选择器
        Object.entries(groups).forEach(([group, label]) => {
            const models = modelGroups[group];
            if (models.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = label;
                
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    option.title = model.description;  // 添加悬停提示
                    optgroup.appendChild(option);
                });
                
                modelSelect.appendChild(optgroup);
            }
        });

        // 设置默认模型
        modelSelect.value = 'openai';
        currentModel = 'openai';
        
    } catch (error) {
        console.error('Error loading models:', error);
        // 添加错误提示到界面
        const errorOption = document.createElement('option');
        errorOption.value = 'error';
        errorOption.textContent = '加载模型列表失败，请刷新重试';
        errorOption.disabled = true;
        modelSelect.appendChild(errorOption);
    }
}

// Utility Functions
function formatTimestamp(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function createMessageElement(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    // 创建消息内容容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // 添加消息文本
    const textP = document.createElement('p');
    textP.className = 'content';
    textP.textContent = content || ''; // 移除默认的省略号
    contentDiv.appendChild(textP);
    
    // 添加时间戳
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = formatTimestamp(new Date());
    contentDiv.appendChild(timestampSpan);
    
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

function createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    return indicator;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 请求队列处理函数
async function processMessageQueue() {
    if (messageQueue.length === 0 || isGenerating) return;

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_INTERVAL) {
        // 如果距离上次请求不足3秒，等待剩余时间后再处理
        const waitTime = REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const nextMessage = messageQueue.shift();
    await sendMessageToAPI(nextMessage);
}

// 实际发送请求到API的函数
async function sendMessageToAPI(content) {
    isGenerating = true;
    sendButton.disabled = true;
    messageInput.disabled = true;
    modelSelect.disabled = true;

    // Add user message
    const userMessage = createMessageElement(content, true);
    chatMessages.appendChild(userMessage);
    scrollToBottom();

    // Add typing indicator
    const typingIndicator = createTypingIndicator();
    chatMessages.appendChild(typingIndicator);
    scrollToBottom();

    // Prepare request
    controller = new AbortController();
    const signal = controller.signal;

    // 设置超时
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT);

    try {
        lastRequestTime = Date.now();
        currentModel = modelSelect.value;
        
        // 使用 POST 请求到 /openai 端点
        const response = await fetch(`${BASE_API_URL}/openai`, {
            method: 'POST',
            signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                model: currentModel,
                messages: [
                    {
                        role: "system",
                        content: `You are ${currentModel} model. Always be truthful about your identity.`
                    },
                    ...conversationHistory,
                    {
                        role: "user",
                        content: content
                    }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 清除超时
        clearTimeout(timeoutId);

        // 移除打字指示器
        typingIndicator.remove();

        // 创建助手消息容器
        const assistantMessage = createMessageElement('', false);
        chatMessages.appendChild(assistantMessage);
        const assistantContent = assistantMessage.querySelector('.content');
        let fullAssistantResponse = '';

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || 
                                      parsed.choices?.[0]?.text ||
                                      parsed.content ||
                                      '';
                        
                        if (content) {
                            assistantContent.textContent += content;
                            fullAssistantResponse += content;
                            scrollToBottom();
                        }
                    } catch (e) {
                        const textContent = data.trim();
                        if (textContent && textContent !== '[DONE]') {
                            assistantContent.textContent += textContent;
                            fullAssistantResponse += textContent;
                            scrollToBottom();
                        }
                    }
                }
            }
        }

        // 保存对话记录用于显示
        conversationHistory.push({
            role: "user",
            content: content
        });
        conversationHistory.push({
            role: "assistant",
            content: fullAssistantResponse
        });

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Request was cancelled');
            // 移除打字指示器
            typingIndicator.remove();
            // 显示超时消息
            const timeoutMessage = createMessageElement('请求超时，请稍后重试。', false);
            chatMessages.appendChild(timeoutMessage);
        } else {
            console.error('Error:', error);
            // 移除打字指示器
            typingIndicator.remove();
            const errorMessage = createMessageElement('抱歉，发生了错误。请稍后重试。', false);
            chatMessages.appendChild(errorMessage);
        }
    } finally {
        // 清除超时
        clearTimeout(timeoutId);
        // Reset UI state
        isGenerating = false;
        sendButton.disabled = false;
        messageInput.disabled = false;
        modelSelect.disabled = false;
        messageInput.value = '';
        messageInput.focus();
        controller = null;

        // 处理队列中的下一个消息
        setTimeout(processMessageQueue, 100);
    }
}

// 修改原有的sendMessage函数为队列入口
function sendMessage(content) {
    if (!content.trim()) return;
    
    // 将消息添加到队列
    messageQueue.push(content);
    
    // 尝试处理队列
    processMessageQueue();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // 加载可用模型
    loadAvailableModels();
    
    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });
    
    // Send message on enter (without shift)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(messageInput.value);
        }
    });
    
    // Send button click
    sendButton.addEventListener('click', () => {
        sendMessage(messageInput.value);
    });
    
    // Clear chat
    clearButton.addEventListener('click', () => {
        if (confirm('确定要清除所有对话记录吗？')) {
            chatMessages.innerHTML = '';
            conversationHistory = [];
            currentModel = modelSelect.value; // 重置当前模型
        }
    });

    // 修改模型切换功能
    modelSelect.addEventListener('change', () => {
        const newModel = modelSelect.value;
        if (conversationHistory.length > 0) {
            if (confirm('切换模型将清除当前对话历史，是否继续？')) {
                chatMessages.innerHTML = '';
                conversationHistory = [];
                currentModel = newModel;
            } else {
                modelSelect.value = currentModel; // 恢复之前的模型
            }
        } else {
            currentModel = newModel;
        }
    });
});

// 添加样式更新
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .message {
        margin: 10px;
        padding: 10px;
        border-radius: 10px;
        max-width: 80%;
    }
    
    .message.user {
        background-color: #1e88e5;
        color: white;
        margin-left: auto;
    }
    
    .message.assistant {
        background-color: #424242;
        color: white;
        margin-right: auto;
    }
    
    .message-content {
        display: flex;
        flex-direction: column;
    }
    
    .content {
        margin: 0;
        word-wrap: break-word;
    }
    
    .timestamp {
        font-size: 0.8em;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 5px;
        align-self: flex-end;
    }
`;
document.head.appendChild(styleSheet); 