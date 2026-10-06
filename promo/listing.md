# Chrome Web Store listing

The text for each field of the store's developer dashboard, ready to paste.
Update it in the same change that alters what it describes.

The short description is not here. The store reads it from the manifest's
`description`, which resolves per locale from `src/_locales/*/messages.json`;
`test/manifest.test.ts` keeps each one within the store's 132 characters.

## Store listing tab

### Detailed description (English)

```text
Razorshell gives web text fields the keys of a bash prompt.

Ctrl+A and Ctrl+E jump to the start and end of the line. Ctrl+K kills to the end of the line and Ctrl+U to its start; Ctrl+Y yanks the text back, and Alt+Y cycles through earlier kills. Alt+F and Alt+B move by word, Alt+D and Alt+Backspace kill a word, Ctrl+D and Ctrl+H delete a character. Alt+U, Alt+L and Alt+C change the case of a word, Alt+T swaps two words, and Ctrl+/ undoes.

It works in single-line inputs, text areas, fields in frames and open shadow roots, and, if you turn it on, in rich text editors such as Gmail's composer.

Kill whole field (Ctrl+C), accept line (Ctrl+J) and open line (Ctrl+O) are available but unassigned, because those chords are copy, downloads and open-file in the browser. Assign them on the options page if you want them. Ctrl+W and Ctrl+T can also be reclaimed through Chrome's own shortcuts page; outside a text field they still close and open tabs.

The options page lets you:
- rebind any chord, with conflicts refused;
- switch Razorshell on or off per site with ordered allow and deny rules;
- export and import every setting as one JSON file;
- try each chord in a test area.

Click the toolbar icon and then a text field to see which of your bindings the page already handles itself.

Killed text stays in the page's frame. It is never written to storage, never sent anywhere, and never kept from a password field.

Not supported: macOS (Option composes characters, so the Alt bindings cannot match), email and number fields, and closed shadow roots.

Source, issue forms and discussions: https://github.com/ShortArrow/razorshell
```

### Detailed description (日本語)

```text
Razorshell は、Web のテキスト欄で bash のプロンプトと同じキー操作を使えるようにする拡張機能です。

Ctrl+A と Ctrl+E で行頭と行末へ移動します。Ctrl+K はカーソルから行末まで、Ctrl+U は行頭まで切り取り、Ctrl+Y で貼り戻します。直後の Alt+Y で、さらに前に切り取った内容に切り替わります。Alt+F と Alt+B は単語単位の移動、Alt+D と Alt+Backspace は単語の切り取り、Ctrl+D と Ctrl+H は 1 文字の削除です。Alt+U、Alt+L、Alt+C は単語の大文字小文字を変え、Alt+T は前後の単語を入れ替え、Ctrl+/ は元に戻します。

1 行の入力欄、複数行のテキストエリア、フレームや開いた Shadow DOM の中の欄で動きます。設定を有効にすれば、Gmail の作成画面のようなリッチテキストエディタでも動きます。

フィールド全体の切り取り（Ctrl+C）、行の確定（Ctrl+J）、行の挿入（Ctrl+O）も用意していますが、初期状態では割り当てていません。ブラウザではそれぞれコピー、ダウンロード、ファイルを開く操作に使われているためです。使いたい場合はオプションページで割り当ててください。Ctrl+W と Ctrl+T も Chrome のショートカット設定ページで割り当てられます。テキスト欄の外では、これまでどおりタブを閉じたり開いたりします。

オプションページでは次のことができます。
- 好きなキーへの割り当て直し（他の操作と重なる割り当ては拒否します）
- 許可と拒否のルールによる、サイトごとの有効化と無効化
- 全設定の JSON ファイルへの書き出しと読み込み
- テスト欄での各キーの動作確認

ツールバーのアイコンを押してからテキスト欄をクリックすると、ページ自身がすでに使っているキーを調べられます。

切り取った文字列はそのページのフレームの中にだけ保持します。保存も外部への送信もせず、パスワード欄の内容は保持しません。

対応していないもの: macOS（Option キーが文字を入力するため、Alt の操作が一致しません）、メールアドレス欄と数値欄、閉じた Shadow DOM。

ソースコード、不具合報告、ディスカッション: https://github.com/ShortArrow/razorshell
```

### Category

Developer Tools

## Privacy practices tab

### Single purpose

```text
Adds bash and Emacs (readline) editing keys to text fields on web pages.
```

### Permission justification: storage

```text
Stores the user's settings (rebound keys, per-site rules, language, theme and the rich text option) in chrome.storage.sync so they apply in every tab and survive a restart.
```

### Permission justification: host permissions (all sites)

```text
The editing keys must work in text fields on any site the user visits. The content script listens for the user's own keystrokes in those fields and edits only the focused field. Per-site rules on the options page turn it off where the user does not want it.
```

### Remote code

```text
No. All code is packaged in the extension.
```

### Data usage

Check none of the data types. Razorshell collects and transmits no user data:
keystrokes are handled inside the page, killed text stays in memory in that
frame, and settings stay in the user's own Chrome sync storage.
