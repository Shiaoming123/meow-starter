import { isUpdaterConfiguredForBuild } from './updater-config'

export type UpdatePhase =
  | 'idle'
  | 'unconfigured'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'error'

export interface UpdateState {
  phase: UpdatePhase
  /** 下载进度 0–100 */
  percent: number
  message: string
}

export const IDLE_UPDATE_STATE: UpdateState = { phase: 'idle', percent: 0, message: '' }

/**
 * 检查并安装更新。
 *
 * @param onState 进度回调，用于驱动 UI
 * @param options.silent 为 true 时无可用更新不弹提示（适合启动时后台检查）
 */
export async function checkForUpdates(
  onState: (state: UpdateState) => void,
  options: { silent?: boolean } = {},
): Promise<void> {
  if (!isUpdaterConfiguredForBuild()) {
    onState({
      phase: 'unconfigured',
      percent: 0,
      message: '更新器尚未配置：请先替换仓库端点并生成自己的签名密钥。',
    })
    return
  }

  try {
    onState({ phase: 'checking', percent: 0, message: '正在检查更新…' })

    const [{ ask }, { relaunch }, { check }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-process'),
      import('@tauri-apps/plugin-updater'),
    ])

    const update = await check()
    if (!update) {
      onState({
        phase: 'idle',
        percent: 0,
        message: options.silent ? '' : '已经是最新版本',
      })
      return
    }

    const notes = update.body?.trim()
    const confirmed = await ask(
      `发现新版本 ${update.version}${notes ? `\n\n${notes}` : ''}\n\n是否立即下载并安装？`,
      { title: '检查更新', kind: 'info', okLabel: '更新', cancelLabel: '稍后' },
    )
    if (!confirmed) {
      onState(IDLE_UPDATE_STATE)
      return
    }

    let contentLength = 0
    let downloaded = 0

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0
          onState({ phase: 'downloading', percent: 0, message: '开始下载更新…' })
          break
        case 'Progress':
          downloaded += event.data.chunkLength
          onState({
            phase: 'downloading',
            percent: contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0,
            message: '正在下载更新…',
          })
          break
        case 'Finished':
          onState({ phase: 'installing', percent: 100, message: '下载完成，正在安装…' })
          break
      }
    })

    // Windows 上 install 时应用会被自动退出，这行只在 macOS / Linux 生效
    await relaunch()
  } catch (error) {
    onState({
      phase: 'error',
      percent: 0,
      message: `更新失败：${error instanceof Error ? error.message : String(error)}`,
    })
  }
}
