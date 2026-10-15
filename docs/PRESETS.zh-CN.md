# 在 Android 版 pane-by-pane 中导入自己的 Glimmith 关卡

> 本项目**不包含《The Artisan of Glimmith》官方关卡数据**。内置的两关是独立制作的测试示例，**不是官方关卡**。游戏本身以及设计的关卡可能受版权保护；请只在自己合法获取的数据上进行个人研究，不要把官方关卡包提交到公开 GitHub 仓库或再分发。

## 一、在手机中直接导入 JSON

打开游戏，向下滚动到 **预设关卡**。点击 **导入本地 JSON 关卡包**，选择生成好的 JSON 文件。验证通过后，关卡将保存在设备的 IndexedDB 中，**离线可玩**；可以用 **上一关 / 下一关** 切换。原有的随机生成关卡不受影响。

支持两种输入：
- 标准关卡包：`{"version":1,"name":"我的关卡","levels":[...]}`
- 本项目生成器输出的 JSON 数组：`node src/cli.ts gen ... --json my-puzzles.json`

关卡定义格式：

```json
{
  "version": 1,
  "name": "私人关卡",
  "levels": [
    {
      "id": "example-001",
      "title": "示例关卡 1",
      "chapter": "练习",
      "source": "local export",
      "stars": 1,
      "difficulty": 0,
      "puzzle": {
        "width": 3,
        "height": 3,
        "clues": [
          {"type": "areaNumber", "cell": 0, "value": 3},
          {"type": "areaNumber", "cell": 1, "value": 3},
          {"type": "areaNumber", "cell": 2, "value": 3}
        ]
      },
      "solution": [0,1,2, 0,1,2, 0,1,2]
    }
  ]
}
```

`solution` 不是颜色，而是每个格子所在**区域编号**（0 开始、可重复），空洞是 `-1`。每关在导入前会用现有游戏规则引擎验证答案，不合法的数据不会被载入。

## 二、从自己游戏中的 SV1 导出转换

可以参考开源工具 [GlimmithSolutionView](https://github.com/mevinagrise/GlimmithSolutionView)，在合法拥有的 Windows Steam 游戏中导出正在查看的关卡。它按 F6 后将当前谜题渲染模型写入 `ue4ss/bridge/solution_view.txt`，格式以 `SV1` 开头。把**每道关卡**的文本另存为不同名字的 `.txt` 或 `.sv1` 文件（原工具的桥接文件会被下一关覆盖）。

在 **Node 22.18+** 的项目目录运行：

```sh
node scripts/convert-glimmith-sv1.mjs \
  --input ./private-exports \
  --output ./my-glimmith.json \
  --meta ./my-metadata.json
```

`--meta` 可以省略。需要对某些关卡补充原版界面的全局规则时，提供按公开谜题 ID 编写的元数据：

```json
{
  "01234": {
    "title": "面积练习",
    "chapter": "森林入口",
    "clues": [
      {"type": "range", "min": 2, "max": 6},
      {"type": "sizeSeparation"}
    ]
  }
}
```

转换器会直接识别 SV1 的数字线索、给定墙、答案墙、双生/异生、面积差、不等式及数字望塔线索；为准确还原原版关卡，**缺失的全局规则必须通过元数据添加**。由于本项目引擎目前没有对应规则、或 SV1 不提供足够信息，下列原版元素不会被猜测转换：罗盘（Compass）、未经映射的形状标记、带框数字格、未映射的其他符号。含有这些元素的关卡会**明确提示跳过**，绝不会把错误题面伪装成可玩的官方关卡。

目前没有获得可合法直接打包的官方全集数据，因此**不能宣称已经完成 1225 个官方谜题导入**；只有通过验证并在输出文件中的关卡可玩。转换报告会输出成功和跳过数量及原因。

## 三、仅在自己构建的 APK 中预置（不上传关卡数据）

如果不想每次在手机上手动选择 JSON 文件，可以在本地将转换结果复制到：

```
public/presets/private.json
```

此路径已加入 `.gitignore`，不会被普通 `git add .` 加入 GitHub。然后按 [ANDROID.md](../ANDROID.md) 在自己的电脑上构建 APK。构建时该 JSON 被复制进离线包，游戏启动后会把它加载为本地预设。

注意：GitHub Actions 从远程仓库 checkout，**读不到你电脑上的私有 JSON**，所以公开仓库上自动生成的 APK 只包含示例，不包含你的私有关卡。直接在手机里导入本地 JSON 不需要重新构建 APK。

## 校验

```sh
npm ci
npm test
npm run build
```

如提示题解不符合规则，请检查：是否缺失全局规则、原版某个符号是否尚未支持、SV1 是否覆盖了所有格子及边线索。转换器设计为**遇到不确定的规则不进行降级猜测**，以免误导游戏体验。
