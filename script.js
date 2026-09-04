// 恋爱开始日期 - 2021年5月2日
const loveStartDate = new Date('2021-05-02T00:00:00');

// 更新爱情计时器
function updateLoveCounter() {
    const now = new Date();
    const diff = now - loveStartDate;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // 更新显示
    const daysElement = document.getElementById('daysCounter');
    const hoursElement = document.getElementById('hoursCounter');
    const minutesElement = document.getElementById('minutesCounter');
    const secondsElement = document.getElementById('secondsCounter');

    if (daysElement) daysElement.textContent = days;
    if (hoursElement) hoursElement.textContent = hours;
    if (minutesElement) minutesElement.textContent = minutes;
    if (secondsElement) secondsElement.textContent = seconds;
}

// 页面加载时启动计时器
if (document.getElementById('daysCounter')) {
    updateLoveCounter();
    setInterval(updateLoveCounter, 1000);
}

// ============ 日记功能 ============

// 从localStorage获取日记（兼容旧数据：旧版单content/mood自动迁移为女生份）
function getDiaries() {
    const diaries = localStorage.getItem('loveDiaries');
    if (!diaries) return [];
    const arr = JSON.parse(diaries);
    // 旧数据迁移：只有 content 没有 girlContent 的，归到女生份
    arr.forEach(d => {
        if (d.content !== undefined && d.girlContent === undefined) {
            d.girlContent = d.content;
            d.girlMood = d.mood || '';
            d.girlEmoji = d.emoji || '';
            d.boyContent = '';
            d.boyMood = '';
            d.boyEmoji = '';
            delete d.content;
            delete d.mood;
            delete d.emoji;
        }
    });
    return arr;
}

// 保存日记到localStorage（同时推送到云端，与对方共享）
function saveDiaries(diaries) {
    localStorage.setItem('loveDiaries', JSON.stringify(diaries));
    // 云端共享：异步推送到 GitHub 私有数据仓库，失败自动保留本地
    if (window.LoveCloud) {
        LoveCloud.pushDiaries(diaries);
    }
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化日期显示
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
}

// 渲染日记列表
function renderDiaries() {
    const diaryList = document.getElementById('diaryList');
    const emptyState = document.getElementById('emptyState');
    const diaryCount = document.getElementById('diaryCount');

    if (!diaryList) return;

    const diaries = getDiaries();

    // 更新计数
    if (diaryCount) {
        diaryCount.textContent = `${diaries.length} 篇日记`;
    }

    // 显示或隐藏空状态
    if (diaries.length === 0) {
        diaryList.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    diaryList.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    // 按日期排序（最新的在前）
    const sortedDiaries = [...diaries].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    // 清空列表
    diaryList.innerHTML = '';

    // 渲染每个日记条目
    sortedDiaries.forEach(diary => {
        const diaryItem = document.createElement('div');
        diaryItem.className = 'diary-item';

        // 女生心情展示
        const girlMoodHtml = (diary.girlMood && diary.girlEmoji)
            ? `<span class="diary-mood-tag girl-mood">今日心情：${diary.girlEmoji} ${escapeHtml(diary.girlMood)}</span>`
            : '';
        // 男生心情展示
        const boyMoodHtml = (diary.boyMood && diary.boyEmoji)
            ? `<span class="diary-mood-tag boy-mood">今日心情：${diary.boyEmoji} ${escapeHtml(diary.boyMood)}</span>`
            : '';

        // 女生内容（有内容才显示该层）
        const girlLayer = diary.girlContent
            ? `<div class="diary-layer girl-layer">
                   <p class="diary-content-text girl-text">${escapeHtml(diary.girlContent)}</p>
                   ${girlMoodHtml}
               </div>`
            : '';
        // 男生内容（有内容才显示该层）
        const boyLayer = diary.boyContent
            ? `<div class="diary-layer boy-layer">
                   <p class="diary-content-text boy-text">${escapeHtml(diary.boyContent)}</p>
                   ${boyMoodHtml}
               </div>`
            : '';

        diaryItem.innerHTML = `
            <!-- 第一层：标题 + 创建时间 -->
            <div class="diary-item-header">
                <h3 class="diary-title">${escapeHtml(diary.title)}</h3>
                <span class="diary-date">${formatDate(diary.date)}</span>
            </div>
            <!-- 第二层：女生日记（粉色） -->
            ${girlLayer}
            <!-- 第三层：男生日记（蓝色） -->
            ${boyLayer}
            <!-- 第四层：编辑与删除按钮（右侧并排） -->
            <div class="diary-actions">
                <button class="action-btn edit-btn" onclick="editDiary('${diary.id}')">✏️ 编辑</button>
                <button class="action-btn delete-btn" onclick="showDeleteModal('${diary.id}')">🗑️ 删除</button>
            </div>
        `;
        diaryList.appendChild(diaryItem);
    });
}

// HTML转义，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加或更新日记
function saveDiary(e) {
    e.preventDefault();

    const id = document.getElementById('diaryId').value;
    const date = document.getElementById('diaryDate').value;
    const title = document.getElementById('diaryTitle').value.trim();
    const girlContent = document.getElementById('girlContent').value.trim();
    const boyContent = document.getElementById('boyContent').value.trim();

    if (!date || !title) {
        alert('请填写日期和标题！');
        return;
    }
    if (!girlContent && !boyContent) {
        alert('请至少填写女生日记或男生日记的内容！');
        return;
    }

    // 读取双方心情
    const girlMoodInput = document.querySelector('.diary-mood[data-side="girl"]');
    const girlEmojiInput = document.querySelector('.diary-emoji[data-side="girl"]');
    const boyMoodInput = document.querySelector('.diary-mood[data-side="boy"]');
    const boyEmojiInput = document.querySelector('.diary-emoji[data-side="boy"]');

    const diaryData = {
        id: id || generateId(),
        date,
        title,
        girlContent,
        girlMood: girlMoodInput ? girlMoodInput.value : '',
        girlEmoji: girlEmojiInput ? girlEmojiInput.value : '',
        boyContent,
        boyMood: boyMoodInput ? boyMoodInput.value : '',
        boyEmoji: boyEmojiInput ? boyEmojiInput.value : ''
    };

    const diaries = getDiaries();

    if (id) {
        // 更新现有日记
        const index = diaries.findIndex(d => d.id === id);
        if (index !== -1) {
            diaries[index] = diaryData;
        }
    } else {
        // 添加新日记
        diaries.push(diaryData);
    }

    saveDiaries(diaries);
    resetForm();
    renderDiaries();

    // 显示成功消息
    showSuccessMessage(id ? '日记已更新！' : '日记已保存！');
}

// 编辑日记
function editDiary(id) {
    const diaries = getDiaries();
    const diary = diaries.find(d => d.id === id);

    if (!diary) return;

    // 填充表单
    document.getElementById('diaryId').value = diary.id;
    document.getElementById('diaryDate').value = diary.date;
    document.getElementById('diaryTitle').value = diary.title;
    document.getElementById('girlContent').value = diary.girlContent || '';
    document.getElementById('boyContent').value = diary.boyContent || '';

    // 填充双方心情（更新心情展示区和选中状态）
    setSideMood('girl', diary.girlMood || '', diary.girlEmoji || '');
    setSideMood('boy', diary.boyMood || '', diary.boyEmoji || '');

    // 更新表单标题和按钮
    document.getElementById('formTitle').textContent = '✏️ 编辑日记';
    document.getElementById('submitBtn').textContent = '💕 更新日记';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    // 滚动到表单
    document.querySelector('.diary-form-section').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// 设置某一方的心情（编辑时回填用）
function setSideMood(side, mood, emoji) {
    const moodInput = document.querySelector('.diary-mood[data-side="' + side + '"]');
    const emojiInput = document.querySelector('.diary-emoji[data-side="' + side + '"]');
    const preview = document.querySelector('.mood-preview[data-side="' + side + '"]');
    if (moodInput) moodInput.value = mood;
    if (emojiInput) emojiInput.value = emoji;
    if (preview) {
        const pe = preview.querySelector('.preview-emoji');
        const pt = preview.querySelector('.preview-text');
        if (pe) pe.textContent = emoji || '😊';
        if (pt) pt.textContent = mood || '暖心';
    }
    // 更新按钮选中状态
    const selector = document.querySelector('.mood-selector[data-side="' + side + '"]');
    if (selector) {
        selector.querySelectorAll('.mood-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.mood === mood);
        });
    }
}

// 显示删除确认模态框
let deleteTargetId = null;

function showDeleteModal(id) {
    deleteTargetId = id;
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// 隐藏删除确认模态框
function hideDeleteModal() {
    deleteTargetId = null;
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 确认删除日记
function confirmDeleteDiary() {
    if (!deleteTargetId) return;

    let diaries = getDiaries();
    diaries = diaries.filter(d => d.id !== deleteTargetId);
    saveDiaries(diaries);

    hideDeleteModal();
    renderDiaries();
    showSuccessMessage('日记已删除！');
}

// 重置表单
function resetForm() {
    document.getElementById('diaryForm').reset();
    document.getElementById('diaryId').value = '';
    document.getElementById('formTitle').textContent = '✨ 写一篇新的恋爱日记';
    document.getElementById('submitBtn').textContent = '💕 保存日记';
    document.getElementById('cancelBtn').style.display = 'none';

    // 重置双方心情
    setSideMood('girl', '', '');
    setSideMood('boy', '', '');

    // 设置默认日期为今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('diaryDate').value = today;
}

// 显示成功消息
function showSuccessMessage(message) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #8BC34A);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
    `;
    toast.textContent = message;

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 心情选择功能（支持女生/男生两套独立选择器）
function initMoodSelector() {
    document.querySelectorAll('.mood-selector').forEach(selector => {
        const side = selector.dataset.side;
        const moodButtons = selector.querySelectorAll('.mood-btn');
        const preview = document.querySelector('.mood-preview[data-side="' + side + '"]');
        const moodInput = document.querySelector('.diary-mood[data-side="' + side + '"]');
        const emojiInput = document.querySelector('.diary-emoji[data-side="' + side + '"]');

        moodButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 只移除当前选择器内按钮的选中状态
                moodButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');

                const mood = button.dataset.mood;
                const emoji = button.dataset.emoji;

                // 更新心情展示
                if (preview) {
                    const pe = preview.querySelector('.preview-emoji');
                    const pt = preview.querySelector('.preview-text');
                    if (pe) {
                        pe.style.animation = 'none';
                        setTimeout(() => { pe.textContent = emoji; pe.style.animation = 'pulse 0.5s ease'; }, 50);
                    }
                    if (pt) {
                        pt.style.animation = 'none';
                        setTimeout(() => { pt.textContent = mood; pt.style.animation = 'slideIn 0.3s ease'; }, 50);
                    }
                }

                // 更新隐藏字段
                if (moodInput) moodInput.value = mood;
                if (emojiInput) emojiInput.value = emoji;
            });
        });
    });
}

// 光标跟随效果
function initCursorFollower() {
    document.addEventListener('mousemove', (e) => {
        const cursor = document.createElement('div');
        cursor.className = 'cursor-follower';
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        cursor.style.opacity = '0.3'; // 透明度改为0.3

        // 添加爱心图标
        cursor.innerHTML = '💕';

        // 移除旧的跟随元素
        const oldCursor = document.querySelector('.cursor-follower');
        if (oldCursor) {
            oldCursor.remove();
        }

        document.body.appendChild(cursor);

        // 2秒后移除
        setTimeout(() => {
            cursor.style.transition = 'opacity 0.5s';
            cursor.style.opacity = '0';
            setTimeout(() => cursor.remove(), 500);
        }, 2000);
    });

    // 点击特效
    document.addEventListener('click', (e) => {
        const clickEffect = document.createElement('div');
        clickEffect.className = 'click-effect';
        clickEffect.style.left = e.clientX + 'px';
        clickEffect.style.top = e.clientY + 'px';

        // 随机选择一个爱心表情
        const hearts = ['❤️', '💕', '💖', '💗', '💘', '💝', '💟'];
        const randomHeart = hearts[Math.floor(Math.random() * hearts.length)];
        clickEffect.innerHTML = randomHeart;

        document.body.appendChild(clickEffect);

        // 动画效果
        clickEffect.style.animation = 'clickPop 1s ease-out forwards';

        // 移除元素
        setTimeout(() => {
            clickEffect.remove();
        }, 1000);
    });

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes clickPop {
            0% {
                transform: scale(0) rotate(0deg);
                opacity: 1;
            }
            50% {
                transform: scale(1.5) rotate(180deg);
                opacity: 0.8;
            }
            100% {
                transform: scale(0) rotate(360deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 初始化日记页面
function initDiaryPage() {
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('diaryDate');
    if (dateInput) {
        dateInput.value = today;
    }

    // 初始化表情包选择器
    initMoodSelector();

    // 初始化光标跟随效果
    initCursorFollower();

    // 渲染日记列表
    renderDiaries();

    // 绑定表单提交事件
    const form = document.getElementById('diaryForm');
    if (form) {
        form.addEventListener('submit', saveDiary);
    }

    // 绑定取消按钮事件
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetForm);
    }

    // 绑定删除模态框按钮事件
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const confirmCancelBtn = document.getElementById('confirmCancel');

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteDiary);
    }

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', hideDeleteModal);
    }

    // 点击模态框背景关闭
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideDeleteModal();
            }
        });
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    initDiaryPage();
    // 云端共享：打开日记页时拉取对方保存的最新日记并刷新列表（仅日记页）
    if (window.LoveCloud && document.getElementById('diaryList')) {
        LoveCloud.pullDiaries().then(function (cloudDiaries) {
            if (cloudDiaries) renderDiaries();
        });
    }
});

// 添加一些示例数据（如果localStorage为空）
function addSampleData() {
    const diaries = getDiaries();
    if (diaries.length === 0) {
        const sampleDiaries = [
            {
                id: generateId(),
                date: '2021-05-02',
                title: '我们在一起了！',
                girlContent: '今天是我们正式确定关系的第一天，真的很开心！从今天开始，我要好好珍惜这段感情，和你一起走过每一个春夏秋冬。',
                girlMood: '幸福',
                girlEmoji: '💕',
                boyContent: '',
                boyMood: '',
                boyEmoji: ''
            },
            {
                id: generateId(),
                date: '2021-06-01',
                title: '儿童节的惊喜',
                girlContent: '今天你给我准备了儿童节惊喜，虽然我们都已经不是小孩子了，但在你面前，我永远可以像个孩子一样。谢谢你让我感受到这份纯真的快乐。',
                girlMood: '愉悦',
                girlEmoji: '🥰',
                boyContent: '',
                boyMood: '',
                boyEmoji: ''
            },
            {
                id: generateId(),
                date: '2021-08-15',
                title: '第一次一起看电影',
                girlContent: '今天我们一起去看了电影，你在我身边的感觉真好。电影的内容我已经记不太清楚了，但是和你在一起的每一个瞬间都深深印在了我的心里。',
                girlMood: '暖心',
                girlEmoji: '😊',
                boyContent: '',
                boyMood: '',
                boyEmoji: ''
            }
        ];

        saveDiaries(sampleDiaries);
        renderDiaries();
    }
}

// 在初始化后添加示例数据
setTimeout(addSampleData, 500);

// ============ 节日与纪念日提醒 ============

// 固定日期（公历）的节日和纪念日
const fixedSpecialDays = [
    { month: 1,  day: 1,  name: '元旦', emoji: '🎊', message: '新的一年，也要一直在一起 🎆' },
    { month: 2,  day: 14, name: '情人节', emoji: '💘', message: '情人节快乐，最爱的人是你！' },
    { month: 5,  day: 2,  name: '恋爱纪念日', emoji: '💍', isAnniversary: true },
    { month: 5,  day: 20, name: '520', emoji: '💖', message: '520，我爱你！' },
    { month: 12, day: 25, name: '圣诞节', emoji: '🎄', message: '圣诞快乐，想和你一起看雪 ❄️' },
    { month: 12, day: 31, name: '跨年夜', emoji: '🎆', message: '一起跨年，年年有今日！' },
    // 生日提醒：把日期改成你们俩的生日，删掉行首的 // 即可 🎂
    // { month: 1, day: 1, name: '家琦的生日', emoji: '🎂', message: '生日快乐，我最爱的人！' },
    // { month: 1, day: 1, name: '意颖的生日', emoji: '🎂', message: '生日快乐，我最爱的人！' },
];

// 农历节日（七夕 = 农历七月初七）对应的公历日期，按年份查表
// 新的一年直接加一行就好
const lunarSpecialDays = {
    2026: [{ month: 8, day: 19, name: '七夕节', emoji: '🎋', message: '七夕快乐，牛郎织女都比不上我们 💕' }],
    2027: [{ month: 8, day: 8,  name: '七夕节', emoji: '🎋', message: '七夕快乐，我们的爱情比银河更长 💕' }],
    // 2028: [{ month: 8, day: ?, name: '七夕节', emoji: '🎋', message: '七夕快乐 💕' }],
};

// 获取某一年的全部特殊日子
function getSpecialDaysForYear(year) {
    const days = fixedSpecialDays.map(d => ({ ...d }));
    (lunarSpecialDays[year] || []).forEach(d => days.push({ ...d }));
    return days;
}

// 首页节日/纪念日提醒
function initReminder() {
    const cardEl = document.getElementById('reminderCard');
    const todayEl = document.getElementById('reminderToday');
    const countdownEl = document.getElementById('reminderCountdown');
    if (!cardEl || !todayEl || !countdownEl) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayMatches = [];

    // 每月2号：恋爱月纪念日
    if (now.getDate() === loveStartDate.getDate()) {
        const months = (now.getFullYear() - loveStartDate.getFullYear()) * 12
                     + (now.getMonth() - loveStartDate.getMonth());
        if (months > 0) {
            todayMatches.push({
                emoji: '🗓️',
                name: `恋爱${months}个月纪念日`,
                message: '每个月的这一天，都值得小小庆祝一下 💕'
            });
        }
    }

    // 公历 + 农历节日
    getSpecialDaysForYear(now.getFullYear()).forEach(d => {
        if (d.month === now.getMonth() + 1 && d.day === now.getDate()) {
            todayMatches.push(d);
        }
    });

    // —— 今天的提醒 ——
    if (todayMatches.length > 0) {
        cardEl.classList.add('celebrate');
        todayEl.innerHTML = todayMatches.map(d => {
            let extra = d.message || '';
            if (d.isAnniversary) {
                const years = now.getFullYear() - loveStartDate.getFullYear();
                extra = `我们在一起 ${years} 周年啦！🎂`;
            }
            return `<div class="reminder-today-item">${d.emoji} 今天是 <strong>${d.name}</strong>${extra ? '，' + extra : ''}</div>`;
        }).join('');
    }

    // —— 下一个纪念日倒数（不含每月纪念日） ——
    const upcoming = [];
    [now.getFullYear(), now.getFullYear() + 1].forEach(year => {
        getSpecialDaysForYear(year).forEach(d => {
            const date = new Date(year, d.month - 1, d.day);
            if (date > today) {
                upcoming.push({ ...d, date });
            }
        });
    });
    upcoming.sort((a, b) => a.date - b.date);

    if (upcoming.length > 0) {
        const next = upcoming[0];
        const days = Math.round((next.date - today) / (1000 * 60 * 60 * 24));
        countdownEl.innerHTML = `⏰ 距离 <strong>${next.emoji} ${next.name}</strong> 还有 <span class="reminder-days">${days}</span> 天`;
    }
}

// ============ 首页背景音乐 ============

// 默认播放内置合成的舒缓轻音乐（温柔的五声音阶琶音 + 柔和和弦垫）；
// 若文件夹里有 music.mp3 则自动优先播放它
function initBackgroundMusic() {
    const audio = document.getElementById('bgMusic');
    const btn = document.getElementById('musicToggle');
    if (!audio || !btn) return;

    audio.volume = 0.5;

    const prefKey = 'bgMusicEnabled';
    let ambient = null;      // 内置合成轻音乐
    let useAmbient = false;  // music.mp3 加载失败时切换为 true

    function isPlaying() {
        return useAmbient ? !!(ambient && ambient.playing) : !audio.paused;
    }

    function updateBtn() {
        const playing = isPlaying();
        btn.textContent = playing ? '🎶' : '🎵';
        btn.classList.toggle('playing', playing);
        btn.title = playing ? '暂停背景音乐' : '播放背景音乐';
    }

    // —— 内置舒缓轻音乐：C 大调五声音阶琶音 + C/Am/F/G 和弦垫 ——
    function createAmbient() {
        let ctx = null;
        let master = null;
        let timer = null;
        let playing = false;

        // 五声音阶（没有不和谐音，怎么随机都好听）
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.26, 783.99, 880.00];
        // 和弦垫：C - Am - F - G
        const chords = [
            [130.81, 164.81, 196.00],
            [110.00, 130.81, 164.81],
            [ 87.31, 110.00, 130.81],
            [ 98.00, 123.47, 146.83],
        ];

        // 一颗轻轻的“钢琴音”
        function pluck(freq, time, vol) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(vol, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.5);
            osc.connect(gain).connect(master);
            osc.start(time);
            osc.stop(time + 2.6);
        }

        // 一段缓缓起伏的背景和弦
        function pad(freqs, time, dur) {
            freqs.forEach(f => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = f;
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.04, time + 1.5);
                gain.gain.setValueAtTime(0.04, time + dur - 1.5);
                gain.gain.linearRampToValueAtTime(0, time + dur);
                osc.connect(gain).connect(master);
                osc.start(time);
                osc.stop(time + dur + 0.1);
            });
        }

        // 每 8 秒一小节：一个和弦垫 + 8 颗随机琶音
        function scheduleBar() {
            const t = ctx.currentTime + 0.05;
            pad(chords[Math.floor(Math.random() * chords.length)], t, 8);
            for (let i = 0; i < 8; i++) {
                const note = scale[Math.floor(Math.random() * scale.length)];
                pluck(note, t + i * 1.0 + Math.random() * 0.05, 0.10 + Math.random() * 0.06);
            }
        }

        return {
            get playing() { return playing; },
            start() {
                if (!ctx) {
                    ctx = new (window.AudioContext || window.webkitAudioContext)();
                    master = ctx.createGain();
                    master.gain.value = 0.8;
                    master.connect(ctx.destination);
                }
                ctx.resume();
                playing = true;
                scheduleBar();
                timer = setInterval(() => { if (playing) scheduleBar(); }, 8000);
            },
            stop() {
                playing = false;
                if (timer) { clearInterval(timer); timer = null; }
                if (ctx) { ctx.close(); ctx = null; master = null; }
            }
        };
    }

    function tryPlay() {
        if (useAmbient) {
            if (!ambient) ambient = createAmbient();
            ambient.start();
            updateBtn();
            return;
        }
        const playPromise = audio.play();
        if (playPromise) {
            playPromise.catch(err => {
                // 自动播放被浏览器拦截时保持静默，等用户第一次点击页面再试
                if (err && err.name !== 'NotAllowedError') updateBtn();
            });
        }
    }

    function tryPause() {
        if (useAmbient) {
            ambient.stop();
            updateBtn();
            return;
        }
        audio.pause();
    }

    // music.mp3 不存在（或无法解码）→ 自动切换到内置轻音乐
    audio.addEventListener('error', () => {
        useAmbient = true;
        updateBtn();
    });

    audio.addEventListener('play', updateBtn);
    audio.addEventListener('pause', updateBtn);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPlaying()) {
            localStorage.setItem(prefKey, 'off');
            tryPause();
        } else {
            localStorage.setItem(prefKey, 'on');
            tryPlay();
        }
    });

    // 大多数浏览器禁止自动带声播放：用户第一次点击页面时尝试开始播放
    if (localStorage.getItem(prefKey) !== 'off') {
        document.addEventListener('click', () => {
            if (!isPlaying()) tryPlay();
        }, { once: true });
    }

    updateBtn();
}

document.addEventListener('DOMContentLoaded', () => {
    initReminder();
    initBackgroundMusic();
});