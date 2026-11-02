# dsh-usage-quota

DeepSeek Harness（DSH）插件：把 **思考强度（推理等级）** 和 **当前供应商的额度查询** 放到输入框附近。

无需修改 DSH 自带插件：两个控件都以新增条目的方式注册进 Web UI 的既有插槽。

## 功能

### 1. 思考强度（Codex 风格）

模型选择器右侧新增一个小胶囊，直接显示当前推理等级。点开后是一张紧凑卡片：

- 大字显示当前档位（Low / Medium / High / Extra High / Ultra）。
- 分档滑条 + 档位标签，松手即应用。
- 右上角 `↺` 恢复模型默认强度。
- 支持「关闭思考」的模型会多一个「关闭思考」按钮；不支持关闭的模型（例如要求自适应思考的 Claude 系列）按钮置灰并注明原因，而不是假装可用。

档位来自 DSH 的模型目录（`reasoningEfforts`），因此跟随每个模型的能力，不做猜测。

### 2. 额度查询（自动跟随当前供应商）

底栏显示当前模型供应商的额度，**切供应商会自动换卡片；没有额度接口的供应商直接不显示**：

- **OpenCode Go**（内置）：5 小时 / 每周 / 每月三个窗口的**剩余百分比**，点开可见进度条，用量接近上限时数字变橙色，并显示「几小时后重置 / 几天后重置」。
- **通用余额**（配置）：任意返回 `balance`、`remaining` 或 `quota.remaining` 的兼容接口，显示余额与当日消费。

密钥只由 DSH 宿主进程读取，绝不进入页面脚本；接口调用都发生在宿主侧。

## 安装

要求 DSH `0.2.0-rc.2` 或更高版本（Web / 桌面端）。

### 方式 A：作为 bundle 安装（推荐）

```bash
plugin_manager action=install_bundle target=<本仓库的绝对路径或已发布的包名>
```

插件会在当前 profile 里插入一行 `usage-quota`。

### 方式 B：手动加入 profile 的 `cordis.patch.yml`

```yaml
- insert:
    - id: usage-quota
      name: file:///<本仓库绝对路径>/lib/index.js
```

把路径中的空格与中文按 URL 编码规则处理。改完无需重启，DSH 会热加载配置。

## 配置

默认零配置即可用于 OpenCode Go：宿主会读取凭据服务里的 `OPENCODE_GO_API_KEY`（或同名环境变量）。

打开插件自己的 `cordis.patch.yml` 可以在行上追加 `config`：

```yaml
- insert:
    - id: usage-quota
      name: dsh-usage-quota
      config:
        refreshSeconds: 60
        providers:
          my-relay:
            kind: balance
            label: My Relay
            endpoint: https://relay.example.com/v1/usage
            apiKeyRef: MY_RELAY_API_KEY
```

| 字段 | 说明 |
|---|---|
| `refreshSeconds` | 自动刷新间隔，30–3600，默认 60 |
| `providers.<id>` | 键是 DSH 里的 **provider 路由 id**（即模型菜单里的供应商 id） |
| `kind` | `opencode-go` 或 `balance` |
| `endpoint` | `balance` 必填；必须是 HTTPS 或本机回环地址 |
| `apiKeyRef` | 凭据引用名（DSH 凭据服务或同名环境变量） |
| `label` | 卡片标题 |

配置在加载时校验：未知 `kind`、缺少 endpoint、非 HTTPS 的远程地址、非法凭据引用名都会直接报错，而不是运行期静默失败。

## 隐私与安全

- 仓库里**没有任何密钥**，也没有任何个人路径、用户名或私有中转地址；测试全部使用假的凭据与脚本化的 `fetch`。
- 密钥只在宿主进程内解析（DSH 凭据服务优先，其次同名环境变量），浏览器侧只拿到额度数字。
- 页面与宿主之间只有一条同源、经 DSH 连接鉴权（`requestRejection`）的 `GET /x-usage?provider=<id>` 路由；未登录请求会被拒绝。
- 插件不含任何遥测、上报或第三方统计。
- 刷新间隔偏好写在 `$DSH_HOME/dsh-usage-quota.json`，不写进安装包目录。

## 兼容性

- 依赖 DSH 客户端服务 `modelDirectories`（模型目录）与插槽 `conversation.composer.dock`、`conversation.input.right`。
- 宿主侧依赖 `webServer`、`connection`、`credentials` 三个服务。
- 只使用 Node 内置模块与 Web 标准 API（`fetch`、`AbortSignal.any`），需要 Node 20.3+。

## 开发

```bash
node --test test/host.test.mjs test/client.test.mjs
```

测试覆盖：配置校验、三窗口解析与占位重置时间丢弃、403/401 区分、未知供应商静默、缓存与手动刷新、设置在 Harness home 的持久化，以及客户端注册与可见性判断。

## 许可证

MIT
