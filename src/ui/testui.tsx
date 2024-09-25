import React from "react";
import { keyEventHandling } from "../content";

function handler(event: React.KeyboardEvent<HTMLInputElement>): void {
  keyEventHandling(event.nativeEvent, event.currentTarget);
}

export function TestApp() {
  const testText = "hello world new order";
  return <>
    <div>
      <h2>Test Area</h2>
      <label className="input input-bordered flex" >
        <input type="text" value={testText}
          onKeyDown={handler}
        />
      </label>
    </div>
  </>;
}