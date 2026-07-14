import { describe, expect, it } from "vite-plus/test";
import {
  notificationManager,
  publishNotification,
  publishNotificationBlink,
  subscribeNotificationBlinks,
} from "./NotificationCenter";

describe("notification center", () => {
  it("publishes each notification to the toast manager once", () => {
    const events: Array<unknown> = [];
    const unsubscribe = notificationManager[" subscribe"]((event) => events.push(event));

    publishNotification({
      id: "message-1",
      kind: "chat",
      title: "Show · General",
      description: "Check one two",
    });
    unsubscribe();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "add",
      options: {
        id: "message-1",
        type: "chat",
        title: "Show · General",
        description: "Check one two",
      },
    });
  });

  it("publishes border blinks independently from toast notifications", () => {
    const colors: Array<string | undefined> = [];
    const unsubscribe = subscribeNotificationBlinks((color) => colors.push(color));

    publishNotificationBlink("blue");
    unsubscribe();
    publishNotificationBlink("red");

    expect(colors).toEqual(["blue"]);
  });
});
