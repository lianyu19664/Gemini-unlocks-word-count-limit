// ==UserScript==
// @name         Gemini 解除字数限制锁死 + 智能清空版 (高性能优化版)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  解决Gemini自拦截限制字数问题，高性能零延迟，自动识别用户操作与系统截断
// @author       Azikaban & Gemini AI
// @match        *://gemini.google.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/561665/Gemini%20%E8%A7%A3%E9%99%A4%E5%AD%97%E6%95%B0%E9%99%90%E5%88%B6%E9%94%81%E6%AD%BB%20%2B%20%E6%99%BA%E8%83%BD%E6%B8%85%E7%A9%BA%E7%89%88.user.js
// @updateURL https://update.greasyfork.org/scripts/561665/Gemini%20%E8%A7%A3%E9%99%A4%E5%AD%97%E6%95%B0%E9%99%90%E5%88%B6%E9%94%81%E6%AD%BB%20%2B%20%E6%99%BA%E8%83%BD%E6%B8%85%E7%A9%BA%E7%89%88.meta.js
// ==/UserScript==

/*
  ==========================================================================
  COLLABORATION STATEMENT:
  This script was co-authored by a human user and Gemini (AI). Please review the code before using it.
  ==========================================================================
  MIT License

  Copyright (c) 2024 Gemini Helper

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

(function() {
    'use strict';

    // 1. 区分 "用户手动删除" 与 "系统自动截断"
    // 只有用户没有操作键盘，且文本被大段删除时，才判定为系统拦截
    let lastUserActionTs = 0;
    const updateActionTs = () => { lastUserActionTs = Date.now(); };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') updateActionTs();
    }, true);
    window.addEventListener('cut', updateActionTs, true);

    // 2. 核心劫持
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
        
        // 非核心属性直接放行，减少对页面的干扰
        if (prop !== 'insertAt' && prop !== 'deleteAt') {
            return originalDefineProperty.apply(this, arguments);
        }

        // 劫持insertAt，仅用于维护长度计数，O(1) 复杂度
        if (prop === 'insertAt' && descriptor.value) {
            const originalInsert = descriptor.value;
            descriptor.value = function(index, text, formatting) {
                // 初始化影子长度
                if (typeof this.__shadowLen !== 'number') this.__shadowLen = 0;

                // 更新长度：纯数字计算，极大提升长文本性能
                if (typeof text === 'string') {
                    this.__shadowLen += text.length;
                } else {
                    // 处理非文本对象（如图片/卡片），Quill 中长度通常为 1
                    this.__shadowLen += 1;
                }
                return originalInsert.apply(this, arguments);
            };
        }

        // 劫持 deleteAt (删除)：智能防御核心
        if (prop === 'deleteAt' && descriptor.value) {
            const originalDelete = descriptor.value;
            descriptor.value = function(index, length) {
                const currentLen = this.__shadowLen || 0;

                // --- 智能放行逻辑 ---
                
                // 1. 清空/全选删除：从索引 0 开始删，视为合法操作
                // 这完美覆盖了：回车发送清空、点击发送按钮清空、Ctrl+A删除
                const isClear = (index === 0);

                // 2. 用户主动删除：用户刚按了删除键，放行
                const isUserAction = (Date.now() - lastUserActionTs < 200);

                // 3. 打字修补：只删 1-2 个字，放行
                const isTypingFix = (length <= 2);

                if (isClear || isUserAction || isTypingFix) {
                    this.__shadowLen = Math.max(0, currentLen - length);
                    return originalDelete.apply(this, arguments);
                }

                // --- 拦截逻辑 ---
                
                // 系统自动截断特征：不是从头删，也不是用户按键，且删除范围触及了文末
                if ((index + length) >= currentLen) {
                    console.warn(`🛡️ 已拦截 Gemini 自动截断 (Index: ${index}, Len: ${length})`);
                    return; // ⛔ 直接阻止删除
                }

                // 其他情况（如删除中间一段话），放行
                this.__shadowLen = Math.max(0, currentLen - length);
                return originalDelete.apply(this, arguments);
            };
        }

        return originalDefineProperty.apply(this, arguments);
    };

    console.log("🚀 Gemini 字数限制解锁 (高性能版) 已注入");
})();