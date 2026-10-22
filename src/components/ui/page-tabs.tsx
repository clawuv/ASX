import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TabUnderline, useSlidingIndicator } from "./sliding-indicator";

/**
 * 下划线页签：页面级导航（换的是整块内容，例如用量页的「请求日志 / 供应商 / …」、
 * OpenClaw 的「供应商 / 工作区 / 配置」）。
 * 分段控件只留给模式和页内筛选，两者别混用。
 */
export interface PageTabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface PageTabsProps<T extends string> {
  items: PageTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  "aria-label": string;
  /** 页签行右侧的附加内容（筛选、操作按钮） */
  trailing?: React.ReactNode;
  /** 给 tab 按钮生成 id，方便 tabpanel 用 aria-labelledby 指回来 */
  idPrefix?: string;
  /** 与 tabpanel 关联时传入 */
  controls?: string;
  /** 超宽时隐藏原生横向滚动条，用上下箭头和边缘渐隐导航 */
  scrollable?: boolean;
  leftScrollLabel?: string;
  rightScrollLabel?: string;
  /**
   * default：一级页签（36 高、13px）；sm：一级页签下面的二级页签（32 高、12px、
   * 不画整行底线，只在选中项下面画线），两层叠在一起时层级才分得清。
   */
  size?: "default" | "sm";
  className?: string;
}

export function PageTabs<T extends string>({
  items,
  value,
  onValueChange,
  trailing,
  idPrefix,
  controls,
  scrollable = false,
  leftScrollLabel = "Scroll left",
  rightScrollLabel = "Scroll right",
  size = "default",
  className,
  ...rest
}: PageTabsProps<T>) {
  const small = size === "sm";
  const refs = React.useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = React.useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const enabled = items.filter((item) => !item.disabled);
  const indicator = useSlidingIndicator<HTMLDivElement>(
    '[aria-selected="true"]',
    value,
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = enabled.findIndex((item) => item.value === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = enabled[next].value;
    onValueChange(target);
    refs.current[target]?.focus();
  };

  const measureScroll = React.useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const canScrollLeft = scroller.scrollLeft > 0;
    const canScrollRight =
      scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1;
    setScrollState((prev) =>
      prev.canScrollLeft === canScrollLeft &&
      prev.canScrollRight === canScrollRight
        ? prev
        : { canScrollLeft, canScrollRight },
    );
  }, []);

  React.useLayoutEffect(() => {
    if (!scrollable) return;
    measureScroll();
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(measureScroll);
    observer.observe(scroller);
    observer.observe(scroller.firstElementChild ?? scroller);
    return () => observer.disconnect();
  }, [measureScroll, scrollable]);

  const scrollTabsViewport = (element: HTMLElement) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const edge = 20;
    const left = element.offsetLeft - edge;
    const right = element.offsetLeft + element.offsetWidth + edge;
    if (left < scroller.scrollLeft) {
      scroller.scrollTo({ left, behavior: "smooth" });
    } else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({
        left: right - scroller.clientWidth,
        behavior: "smooth",
      });
    }
  };

  React.useEffect(() => {
    if (!scrollable) return;
    const selected = refs.current[value];
    if (selected) scrollTabsViewport(selected);
  }, [scrollable, value]);

  return (
    <div
      className={cn(
        small
          ? "flex h-8 items-end gap-3"
          : "flex h-9 items-end gap-4 border-b border-border",
        className,
      )}
    >
      {scrollable ? (
        <div className="relative h-full min-w-0 flex-1">
          <div
            ref={scrollerRef}
            className="no-scrollbar h-full w-full overflow-x-auto overscroll-x-contain"
            onScroll={measureScroll}
            style={{
              maskImage: scrollState.canScrollLeft
                ? scrollState.canScrollRight
                  ? "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent)"
                  : "linear-gradient(to right, transparent 0, black 20px)"
                : scrollState.canScrollRight
                  ? "linear-gradient(to right, black calc(100% - 20px), transparent)"
                  : undefined,
              WebkitMaskImage: scrollState.canScrollLeft
                ? scrollState.canScrollRight
                  ? "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent)"
                  : "linear-gradient(to right, transparent 0, black 20px)"
                : scrollState.canScrollRight
                  ? "linear-gradient(to right, black calc(100% - 20px), transparent)"
                  : undefined,
            }}
          >
            <div
              ref={indicator.ref}
              role="tablist"
              aria-label={rest["aria-label"]}
              className={cn(
                "relative flex h-full w-max items-end",
                small ? "gap-3" : "gap-4",
              )}
            >
              {/* 下划线单独一条，切换时滑过去；一级页签压住整行底线 */}
              <TabUnderline
                rect={indicator.rect}
                animate={indicator.animate}
                className={small ? undefined : "-bottom-px"}
              />
              {items.map((item) => {
                const selected = item.value === value;
                return (
                  <button
                    key={item.value}
                    ref={(element) => {
                      refs.current[item.value] = element;
                    }}
                    type="button"
                    role="tab"
                    id={idPrefix ? `${idPrefix}-${item.value}` : undefined}
                    aria-selected={selected}
                    aria-controls={controls}
                    tabIndex={selected ? 0 : -1}
                    disabled={item.disabled}
                    onClick={() => onValueChange(item.value)}
                    onKeyDown={onKeyDown}
                    className={cn(
                      "h-full whitespace-nowrap border-b-2 px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-fg-3",
                      small
                        ? "inline-flex items-center gap-1.5 text-caption"
                        : "-mb-px text-body",
                      "border-transparent",
                      selected
                        ? "font-semibold text-fg-1"
                        : "font-medium text-fg-2 hover:text-fg-1",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {scrollState.canScrollLeft && (
            <>
              <button
                type="button"
                aria-label={leftScrollLabel}
                onClick={() =>
                  scrollerRef.current?.scrollBy({
                    left: -Math.max(
                      280,
                      scrollerRef.current.clientWidth * 0.75,
                    ),
                    behavior: "smooth",
                  })
                }
                className="absolute left-0 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-subtle hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </>
          )}
          {scrollState.canScrollRight && (
            <>
              <button
                type="button"
                aria-label={rightScrollLabel}
                onClick={() =>
                  scrollerRef.current?.scrollBy({
                    left: Math.max(280, scrollerRef.current.clientWidth * 0.75),
                    behavior: "smooth",
                  })
                }
                className="absolute right-0 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-subtle hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          ref={indicator.ref}
          role="tablist"
          aria-label={rest["aria-label"]}
          className={cn(
            "relative flex h-full items-end",
            small ? "gap-3" : "gap-4",
          )}
        >
          {/* 下划线单独一条，切换时滑过去；一级页签压住整行底线 */}
          <TabUnderline
            rect={indicator.rect}
            animate={indicator.animate}
            className={small ? undefined : "-bottom-px"}
          />
          {items.map((item) => {
            const selected = item.value === value;
            return (
              <button
                key={item.value}
                ref={(element) => {
                  refs.current[item.value] = element;
                }}
                type="button"
                role="tab"
                id={idPrefix ? `${idPrefix}-${item.value}` : undefined}
                aria-selected={selected}
                aria-controls={controls}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => onValueChange(item.value)}
                onKeyDown={onKeyDown}
                className={cn(
                  "h-full whitespace-nowrap border-b-2 px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-fg-3",
                  small
                    ? "inline-flex items-center gap-1.5 text-caption"
                    : "-mb-px text-body",
                  "border-transparent",
                  selected
                    ? "font-semibold text-fg-1"
                    : "font-medium text-fg-2 hover:text-fg-1",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
      {trailing && (
        <>
          <div className="flex-1" />
          <div className="flex h-full items-center">{trailing}</div>
        </>
      )}
    </div>
  );
}
