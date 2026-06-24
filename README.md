# SplitStream Browser Extension (PoC)

2/3分割で同一ページを縦連結スクロールに見せるChrome拡張です。

## セットアップ

1. このフォルダを任意の場所に置く。
2. Chrome のアドレス欄で `chrome://extensions` を開く。
3. 右上の `Developer mode` をONにする。
4. `Load unpacked` を押し、このフォルダを選択する。
5. 拡張が読み込めたら、ツールバーの拡張アイコンから有効化。

## 使い方

- ポップアップで `off / 2 columns / 3 columns` を選択して適用
- 画面上で連続入力で切替
  - `s` のあと `1`: off
  - `s` のあと `2`: 2 columns
  - `s` のあと `3`: 3 columns

## ワンクリック起動

```powershell
./run-splitstream.ps1
```

既定URLを開いた状態で起動します。

## トラブル時

- 拡張が読み込めない場合は、上位にある他の `manifest.json` が混在していない別フォルダでも試してください。
- `chrome://extensions` で「エラー」を確認し、同一のエラーメッセージを共有してください。
- まずは `manifest.json` がJSONとして有効かを確認:
  ```
  node --eval "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('ok')"
  ```
