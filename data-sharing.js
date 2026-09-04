/* ============================================
 * 恋爱日记 · 云端数据共享层 (data-sharing.js)
 * --------------------------------------------
 * 用途：让双方在各自设备/浏览器上保存的日记、图库数据，
 *       通过 GitHub 私有数据仓库（lovediary-data）互通。
 *
 * 原理：
 *   1) 打开页面时先从 GitHub 拉取最新数据，与本地合并（云端为主，保留本地未推送条目）；
 *   2) 保存时先写本地 localStorage（立即生效），再推送到 GitHub（最终权威）。
 *   3) 网络失败时自动回退本地数据，不丢内容。云端为空也不会清空本地已保存数据。
 *
 * 安全说明：
 *   同步密钥（GitHub Token）不会写在本文件里，而是保存在
 *   每台设备的浏览器 localStorage 中。首次使用时在页面上
 *   输入一次密钥，之后自动同步。请保管好密钥，不要外传。
 * ============================================ */
(function () {
    'use strict';

    var CONFIG = {
        owner: 'lovediary2021',
        repo: 'lovediary-data',
        storageKey: 'loveSyncToken'
    };

    var API = 'https://api.github.com';

    // 读取本机保存的同步密钥
    function getToken() {
        return localStorage.getItem(CONFIG.storageKey) || '';
    }

    // 保存同步密钥到本机
    function setToken(token) {
        localStorage.setItem(CONFIG.storageKey, token.trim());
    }

    function base64Encode(str) {
        // 兼容中文：先转 UTF-8 字节再 base64
        return btoa(unescape(encodeURIComponent(str)));
    }

    // 读取文件内容（纯文本）
    async function getFile(name) {
        var url = API + '/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + name;
        var res = await fetch(url, {
            headers: {
                'Authorization': 'Bearer ' + getToken(),
                'Accept': 'application/vnd.github.v3.raw'
            }
        });
        if (!res.ok) throw new Error('GET ' + name + ' -> ' + res.status);
        return await res.text();
    }

    // 获取文件当前 sha（更新文件时必须带上）
    // 说明：contents 接口的响应 ETag 即文件 blob 的 sha，
    //       用 ETag 方式兼容"响应被当作 raw 内容返回"的环境。
    async function getFileSha(name) {
        var url = API + '/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + name;
        var res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        if (!res.ok) throw new Error('SHA ' + name + ' -> ' + res.status);
        var etag = res.headers.get('etag');
        if (etag) return etag.replace(/"/g, '');
        // 兜底：若返回 JSON 元数据则用其中的 sha 字段
        var data = await res.json();
        return data.sha;
    }

    // 写入/更新文件
    async function putFile(name, content, message) {
        var sha = await getFileSha(name);
        var url = API + '/repos/' + CONFIG.owner + '/' + CONFIG.repo + '/contents/' + name;
        var body = {
            message: message || ('同步数据 ' + new Date().toLocaleString('zh-CN')),
            content: base64Encode(content),
            sha: sha
        };
        var res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + getToken(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('PUT ' + name + ' -> ' + res.status);
        return await res.json();
    }

    // ============ 日记同步 ============

    // 合并本地与云端数据：以云端为主（对方最新），同时保留本地独有但云端没有的条目
    // （防止本地刚保存、还没来得及推送成功的数据在下次打开时丢失）
    function mergeLocalAndCloud(localArr, cloudArr) {
        if (!Array.isArray(localArr)) localArr = [];
        if (!Array.isArray(cloudArr)) cloudArr = [];
        // 用 id 作为首选去重标识；没有 id 的条目（如旧版照片）用 url 兜底
        function getItemKey(d) {
            if (!d) return '';
            return d.id || d.url || JSON.stringify(d);
        }
        var cloudKeys = {};
        cloudArr.forEach(function (d) { var k = getItemKey(d); if (k) cloudKeys[k] = true; });
        var localOnly = localArr.filter(function (d) { var k = getItemKey(d); return k && !cloudKeys[k]; });
        return cloudArr.concat(localOnly);
    }

    // 从云端拉取日记，与本地合并后写回（返回合并后的日记数组；失败返回 null）
    async function pullDiaries() {
        try {
            var text = await getFile('diaries.json');
            var cloudArr = JSON.parse(text || '[]');
            var localArr = [];
            try { localArr = JSON.parse(localStorage.getItem('loveDiaries') || '[]'); } catch (e) {}
            var merged = mergeLocalAndCloud(localArr, cloudArr);
            localStorage.setItem('loveDiaries', JSON.stringify(merged));
            return merged;
        } catch (e) {
            console.warn('云端日记拉取失败，继续使用本地数据：', e);
            return null;
        }
    }

    // 将日记推送到云端（失败不抛出，仅告警）
    function pushDiaries(arr) {
        return putFile('diaries.json', JSON.stringify(arr), '同步日记 ' + new Date().toLocaleString('zh-CN'))
            .then(function () { return true; })
            .catch(function (e) {
                console.warn('云端日记推送失败（已保存在本地）：', e);
                return false;
            });
    }

    // ============ 图库同步 ============

    // 从云端拉取图库，与本地合并后写回
    async function pullPhotos() {
        try {
            var text = await getFile('gallery.json');
            var cloudArr = JSON.parse(text || '[]');
            var localArr = [];
            try { localArr = JSON.parse(localStorage.getItem('lovePhotos') || '[]'); } catch (e) {}
            var merged = mergeLocalAndCloud(localArr, cloudArr);
            localStorage.setItem('lovePhotos', JSON.stringify(merged));
            return merged;
        } catch (e) {
            console.warn('云端图库拉取失败，继续使用本地数据：', e);
            return null;
        }
    }

    // 将图库推送到云端
    function pushPhotos(arr) {
        return putFile('gallery.json', JSON.stringify(arr), '同步图库 ' + new Date().toLocaleString('zh-CN'))
            .then(function () { return true; })
            .catch(function (e) {
                console.warn('云端图库推送失败（已保存在本地）：', e);
                return false;
            });
    }

    // ============ 首次使用：输入同步密钥 ============

    // 检查本机是否已配置密钥；未配置则在页面顶部弹出输入条
    function ensureToken() {
        if (getToken()) return true;
        // 已有输入条则不重复创建
        if (document.getElementById('loveSyncBar')) return false;

        var bar = document.createElement('div');
        bar.id = 'loveSyncBar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff0f5;border-bottom:2px solid #ff9ecb;padding:10px 12px;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.15);text-align:center;';
        bar.innerHTML =
            '<div style="font-size:14px;color:#c44569;margin-bottom:6px;">💌 首次使用同步：请输入你们的同步密钥（在另一台设备上输入同一串即可互通）</div>' +
            '<input id="loveSyncKeyInput" type="password" placeholder="粘贴同步密钥" style="padding:6px 10px;border:1px solid #ff9ecb;border-radius:6px;width:60%;max-width:300px;font-size:14px;"/> ' +
            '<button id="loveSyncKeyBtn" style="padding:6px 14px;background:#ff6fa5;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin-left:6px;">开启同步</button>';
        document.body.appendChild(bar);

        document.getElementById('loveSyncKeyBtn').addEventListener('click', function () {
            var key = document.getElementById('loveSyncKeyInput').value.trim();
            if (!key) { alert('请输入同步密钥'); return; }
            setToken(key);
            bar.remove();
            // 配置完成后立即拉取一次
            LoveCloud.pullDiaries().then(function (d) {
                if (d && typeof renderDiaries === 'function') renderDiaries();
            });
            LoveCloud.pullPhotos().then(function (p) {
                if (p && typeof renderPhotos === 'function') renderPhotos();
            });
            alert('✅ 同步已开启！');
        });
        return false;
    }

    // 暴露给其他页面脚本使用
    window.LoveCloud = {
        pullDiaries: pullDiaries,
        pushDiaries: pushDiaries,
        pullPhotos: pullPhotos,
        pushPhotos: pushPhotos,
        ensureToken: ensureToken,
        setToken: setToken
    };

    // 页面加载后自动检查是否已配置密钥
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { LoveCloud.ensureToken(); });
    } else {
        LoveCloud.ensureToken();
    }
})();
