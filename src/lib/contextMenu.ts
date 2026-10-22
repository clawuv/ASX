import { isTextEditableTarget } from "@/utils/domUtils";

/**
 * 全局右键策略：只在可编辑区域（输入框、文本域、CodeMirror 等 contenteditable
 * 元素）或显式标记 data-native-context-menu 的元素内保留 WebView 菜单
 * （剪切/复制/粘贴），其余位置一律屏蔽——原生应用在非文本区域右键没有菜单，
 * WebView2 / WKWebView 的默认菜单（刷新、打印、检查）会立刻暴露网页身份。
 */
export function installContextMenuPolicy(): void {
  window.addEventListener("contextmenu", (event) => {
    if (isTextEditableTarget(event.target)) return;
    if (
      event.target instanceof Element &&
      event.target.closest("[data-native-context-menu]")
    ) {
      return;
    }
    event.preventDefault();
  });
}
