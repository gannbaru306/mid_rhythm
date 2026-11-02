# MIDI Rhythm

MIDIファイルから自動で譜面を作るモバイル向け音ゲー（プロトタイプ）。

## 公開
1. zip を展開し、中身（`index.html` など）をリポジトリの直下に置く。`docs/` に置く場合は Pages の Folder を `/docs` にする。
2. GitHub の Settings > Pages で公開ブランチ（main）とフォルダ（`/ (root)` または `/docs`）を指定する。
3. ローカル確認は `python -m http.server` で起動し、http://localhost:8000 を開く（file:// では動作しません）。

## 構成
- `js/midi-parser.js` MIDI解析 / `js/chart.js` 譜面生成 / `js/audio.js` SoundFont再生 / `js/main.js` 判定・描画・入力
- `vendor/` spessasynth_lib 4.0.19（Apache-2.0）をバンドルしたもの
- `soundfonts/GeneralUser-GS.sf2` GM音源（約32MB）。差し替える場合は `js/main.js` の `SF_URL` を変更

## 現状の範囲
Normal難易度、単押し＋ロング、レーン数3〜8（初期4）。フリック、同時押し、Easy/Hard、全画面タップ型は未実装。
