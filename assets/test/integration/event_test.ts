import { Socket } from "phoenix";
import LiveSocket from "phoenix_live_view/live_socket";

const stubViewPushInput = (view, callback) => {
  view.pushInput = (
    sourceEl,
    targetCtx,
    newCid,
    event,
    pushOpts,
    originalCallback,
  ) => {
    return callback(
      sourceEl,
      targetCtx,
      newCid,
      event,
      pushOpts,
      originalCallback,
    );
  };
};

const prepareLiveViewDOM = (document, rootId) => {
  document.body.innerHTML = `
    <div data-phx-session="abc123"
         data-phx-root-id="${rootId}"
         id="${rootId}">
      <div class="form-wrapper" data-phx-component="2" data-phx-view="root">
        <form id="form" phx-change="validate" phx-target="2">
          <label for="first_name">First Name</label>
          <input id="first_name" value="" name="user[first_name]" />

          <label for="last_name">Last Name</label>
          <input id="last_name" value="" name="user[last_name]" />
        </form>
      </div>
    </div>
  `;
};

const preparePhxKeyDOM = (document, rootId) => {
  document.body.innerHTML = `
    <div data-phx-session="abc123"
         data-phx-root-id="${rootId}"
         id="${rootId}">
      <div data-phx-view="root">
        <div id="single-key" phx-keydown="keydown-event" phx-key="Enter">Single key</div>
        <div id="multiple-keys" phx-keydown="keydown-event" phx-key="Enter,Escape,Tab">Multiple keys</div>
        <div id="keys-with-spaces" phx-keydown="keydown-event" phx-key=" ArrowUp , ArrowDown ">Keys with spaces</div>
        <div id="no-key" phx-keydown="keydown-event">No key restriction</div>
      </div>
    </div>
  `;
};

describe("events", () => {
  beforeEach(() => {
    prepareLiveViewDOM(global.document, "root");
  });

  test("send change event to correct target", () => {
    const liveSocket = new LiveSocket("/live", Socket);
    liveSocket.connect();
    const view = liveSocket.getViewByEl(document.getElementById("root"));
    view.isConnected = () => true;
    const input = view.el.querySelector("#first_name");
    let meta = {
      event: null,
      target: null,
      changed: null,
    };

    stubViewPushInput(
      view,
      (sourceEl, targetCtx, newCid, event, pushOpts, _callback) => {
        meta = {
          event,
          target: targetCtx,
          changed: pushOpts["_target"],
        };
      },
    );

    input.value = "John Doe";
    input.dispatchEvent(new Event("change", { bubbles: true }));

    expect(meta).toEqual({
      event: "validate",
      target: 2,
      changed: "user[first_name]",
    });
  });
});

describe("phx-key filtering", () => {
  beforeEach(() => {
    preparePhxKeyDOM(global.document, "root");
  });

  test("single key filtering allows only specified key", () => {
    const liveSocket = new LiveSocket("/live", Socket);
    liveSocket.connect();
    const view = liveSocket.getViewByEl(document.getElementById("root"));
    view.isConnected = () => true;
    
    const singleKeyElement = document.getElementById("single-key");
    
    let pushCallCount = 0;
    const originalPushEvent = view.pushEvent;
    view.pushEvent = (type, el, targetCtx, event, data, pushOpts, callback) => {
      pushCallCount++;
      return originalPushEvent.call(view, type, el, targetCtx, event, data, pushOpts, callback);
    };

    // Should trigger for Enter key
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    singleKeyElement.dispatchEvent(enterEvent);
    expect(pushCallCount).toBe(1);

    // Should NOT trigger for other keys
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    singleKeyElement.dispatchEvent(escapeEvent);
    expect(pushCallCount).toBe(1); // Still 1, not 2

    const spaceEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    singleKeyElement.dispatchEvent(spaceEvent);
    expect(pushCallCount).toBe(1); // Still 1, not 2
  });

  test("multiple keys filtering allows any specified key", () => {
    const liveSocket = new LiveSocket("/live", Socket);
    liveSocket.connect();
    const view = liveSocket.getViewByEl(document.getElementById("root"));
    view.isConnected = () => true;
    
    const multipleKeysElement = document.getElementById("multiple-keys");
    
    let pushCallCount = 0;
    const originalPushEvent = view.pushEvent;
    view.pushEvent = (type, el, targetCtx, event, data, pushOpts, callback) => {
      pushCallCount++;
      return originalPushEvent.call(view, type, el, targetCtx, event, data, pushOpts, callback);
    };

    // Should trigger for Enter key
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    multipleKeysElement.dispatchEvent(enterEvent);
    expect(pushCallCount).toBe(1);

    // Should trigger for Escape key
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    multipleKeysElement.dispatchEvent(escapeEvent);
    expect(pushCallCount).toBe(2);

    // Should trigger for Tab key
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    multipleKeysElement.dispatchEvent(tabEvent);
    expect(pushCallCount).toBe(3);

    // Should NOT trigger for other keys
    const arrowEvent = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    multipleKeysElement.dispatchEvent(arrowEvent);
    expect(pushCallCount).toBe(3); // Still 3, not 4
  });

  test("keys with whitespace are handled correctly", () => {
    const liveSocket = new LiveSocket("/live", Socket);
    liveSocket.connect();
    const view = liveSocket.getViewByEl(document.getElementById("root"));
    view.isConnected = () => true;
    
    const spacedKeysElement = document.getElementById("keys-with-spaces");
    
    let pushCallCount = 0;
    const originalPushEvent = view.pushEvent;
    view.pushEvent = (type, el, targetCtx, event, data, pushOpts, callback) => {
      pushCallCount++;
      return originalPushEvent.call(view, type, el, targetCtx, event, data, pushOpts, callback);
    };

    // Should trigger for ArrowUp key despite spaces in attribute
    const arrowUpEvent = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    spacedKeysElement.dispatchEvent(arrowUpEvent);
    expect(pushCallCount).toBe(1);

    // Should trigger for ArrowDown key despite spaces in attribute
    const arrowDownEvent = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    spacedKeysElement.dispatchEvent(arrowDownEvent);
    expect(pushCallCount).toBe(2);

    // Should NOT trigger for other keys
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    spacedKeysElement.dispatchEvent(enterEvent);
    expect(pushCallCount).toBe(2); // Still 2, not 3
  });

  test("no phx-key attribute allows all keys", () => {
    const liveSocket = new LiveSocket("/live", Socket);
    liveSocket.connect();
    const view = liveSocket.getViewByEl(document.getElementById("root"));
    view.isConnected = () => true;
    
    const noKeyElement = document.getElementById("no-key");
    
    let pushCallCount = 0;
    const originalPushEvent = view.pushEvent;
    view.pushEvent = (type, el, targetCtx, event, data, pushOpts, callback) => {
      pushCallCount++;
      return originalPushEvent.call(view, type, el, targetCtx, event, data, pushOpts, callback);
    };

    // Should trigger for any key when no phx-key is specified
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    noKeyElement.dispatchEvent(enterEvent);
    expect(pushCallCount).toBe(1);

    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    noKeyElement.dispatchEvent(escapeEvent);
    expect(pushCallCount).toBe(2);

    const spaceEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    noKeyElement.dispatchEvent(spaceEvent);
    expect(pushCallCount).toBe(3);
  });
});
