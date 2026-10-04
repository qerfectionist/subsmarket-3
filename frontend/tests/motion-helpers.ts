import type { Locator } from "@playwright/test";

export type SegmentPositionVariable =
  | "--scope-position"
  | "--catalog-type-position"
  | "--family-type-position";

export async function readSegmentIndicatorGeometry(
  scopeSwitch: Locator,
  segmentIndex: number,
  positionVariable: SegmentPositionVariable
) {
  return scopeSwitch.evaluate(
    (element, { index, variable }) => {
      const segments = Array.from(element.querySelectorAll("button"));
      const target = segments[index];
      if (!target) throw new Error("Scope segment is missing");

      const switchBox = element.getBoundingClientRect();
      const segmentBox = target.getBoundingClientRect();
      const switchStyle = getComputedStyle(element);
      const indicatorStyle = getComputedStyle(element, "::before");
      const indicatorWidth = Number.parseFloat(indicatorStyle.width);
      const indicatorGap = Number.parseFloat(switchStyle.gap);
      const position = Number(element.style.getPropertyValue(variable));

      return {
        position,
        indicatorWidth,
        indicatorLeft:
          switchBox.left +
          Number.parseFloat(switchStyle.borderLeftWidth) +
          Number.parseFloat(switchStyle.paddingLeft) +
          position * (indicatorWidth + indicatorGap),
        segmentWidth: segmentBox.width,
        segmentLeft: segmentBox.left
      };
    },
    { index: segmentIndex, variable: positionVariable }
  );
}

export async function readScopeMotion(scopeSwitch: Locator) {
  return scopeSwitch.evaluate((element) => {
    const track = document.querySelector<HTMLElement>(".my-product-scope-swipe-track");
    const pager = document.querySelector<HTMLElement>(".my-product-scope-swipe-viewport");
    if (!track || !pager) throw new Error("My product scope motion elements are missing");

    const readTranslateX = (transform: string) =>
      transform === "none" ? 0 : new DOMMatrix(transform).m41;
    const segments = Array.from(element.querySelectorAll("button")).map((button) =>
      button.getBoundingClientRect()
    );
    const segmentStep =
      segments.length > 1
        ? segments[1].left - segments[0].left
        : element.getBoundingClientRect().width;
    const panes = Array.from(track.querySelectorAll<HTMLElement>(".my-product-scope-swipe-pane"));

    return {
      trackX: readTranslateX(track.style.transform || getComputedStyle(track).transform),
      segmentStep,
      viewportWidth: pager.clientWidth,
      panes: panes.map((pane) => ({
        scope: pane.dataset.productScope,
        rect: pane.getBoundingClientRect()
      }))
    };
  });
}
