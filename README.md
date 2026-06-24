# SplitStream Chrome Extension (PoC)

この拡張は、開いているページを **1つのスクロールで2列 or 3列** に見せるPoCです。  
列間は目立たないように4pxで、薄い線（column-rule）を入れています。

## 使い方

1. Chrome の `chrome://extensions` を開く
2. 開発者モードをON
3. 「パッケージ化されていない拡張機能を読み込む」からこのリポジトリを選択
4. ブラウザ右上の拡張アイコンを開き、`2 columns / 3 columns` を選択してApply

## ファイル構成

- `manifest.json`: 拡張設定（MV3）
- `content.js`: ページへ `column-count` を注入
- `background.js`: タブごとの列数保持・再読み込み時再適用
- `popup.html` / `popup.js`: 操作用UI

## 注意

- CSS再構成はページ構造によっては崩れる場合があります
- 現在はページ全体を `body` に対して分割する方式のため、サイトごとに微調整が必要になることがあります
