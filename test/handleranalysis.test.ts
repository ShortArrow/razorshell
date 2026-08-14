import { describe, expect, test } from "vitest";
import { analyzeHandlerSource } from "../src/handleranalysis";
import { Chord } from "../src/keymapmerge";

const ctrlK: Chord = { key: "k", ctrl: true };
const ctrlA: Chord = { key: "a", ctrl: true };
const altF: Chord = { key: "f", alt: true };
const chords = [ctrlK, ctrlA, altF];

describe("analyzeHandlerSource", () => {
  test("a literal key test with preventDefault is detected", () => {
    const source = `(e) => { if (e.ctrlKey && e.key === 'k') { e.preventDefault(); insertLink(); } }`;
    expect(analyzeHandlerSource(source, chords)).toEqual([ctrlK]);
  });

  test("keyCode comparisons are detected", () => {
    const source = `function(a){if(a.ctrlKey&&a.keyCode===75){a.preventDefault();b()}}`;
    expect(analyzeHandlerSource(source, chords)).toEqual([ctrlK]);
  });

  test("alt chords need altKey in the source", () => {
    const source = `(e) => { if (e.altKey && e.key === "f") { e.preventDefault(); } }`;
    expect(analyzeHandlerSource(source, chords)).toEqual([altF]);
  });

  test("a dispatcher body reveals nothing", () => {
    const source = `function(e){return t.dispatch(e)}`;
    expect(analyzeHandlerSource(source, chords)).toEqual([]);
  });

  test("without preventDefault nothing is reported", () => {
    const source = `(e) => { if (e.ctrlKey && e.key === 'k') log(e); }`;
    expect(analyzeHandlerSource(source, chords)).toEqual([]);
  });

  test("a different modifier does not match", () => {
    const source = `(e) => { if (e.shiftKey && e.key === 'k') { e.preventDefault(); } }`;
    expect(analyzeHandlerSource(source, chords)).toEqual([]);
  });

  test("the word preventDefault does not count as a quoted letter a", () => {
    const source = `(e) => { if (e.ctrlKey && e.key === 'k') { e.preventDefault(); } }`;
    expect(analyzeHandlerSource(source, [ctrlA])).toEqual([]);
  });

  test("multiple chords in one handler are all reported", () => {
    const source = `(e)=>{ if(!e.ctrlKey) return; if(e.key==='k'||e.key==='a'){ e.preventDefault(); } }`;
    expect(analyzeHandlerSource(source, chords)).toEqual([ctrlK, ctrlA]);
  });
});
