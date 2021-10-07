import {
  Repository,
  isRepositoryWithGitHubRepository,
  RepositoryWithGitHubRepository,
} from '../../models/repository'
import { remote } from 'electron'

export class NotificationsStore {
  private fakePollingTimeoutId: number | null = null
  private repository: RepositoryWithGitHubRepository | null = null

  private unsubscribe() {
    if (this.fakePollingTimeoutId !== null) {
      window.clearTimeout(this.fakePollingTimeoutId)
    }
  }

  private subscribe(repository: RepositoryWithGitHubRepository) {
    this.unsubscribe()

    this.repository = repository

    this.fakePollingTimeoutId = window.setTimeout(() => {
      this.postChecksFailedNotification()
      this.subscribe(repository)
      // eslint-disable-next-line insecure-random
    }, Math.random() * 5000 + 5000)
  }

  public selectRepository(repository: Repository) {
    this.unsubscribe()

    if (!isRepositoryWithGitHubRepository(repository)) {
      return
    }

    this.subscribe(repository)
  }

  private postChecksFailedNotification() {
    if (this.repository === null) {
      return
    }

    const workflowName = 'CI'
    const prName = 'Bump Git to 2.32.0 and Git LFS to 2.13.3'
    const commitSha = 'b0e713a'
    const NOTIFICATION_TITLE = 'PR run failed'
    const NOTIFICATION_BODY = `${workflowName} - ${prName} (${commitSha})\nSome jobs were not successful.`
    const notification = new remote.Notification({
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY,
      actions: [
        {
          type: 'button',
          text: 'Merge',
        },
      ],
    })

    notification.on('click', () => {
      alert('default handler')
    })

    notification.on('action', () => {
      alert(`Merge clicked`)
    })

    notification.show()
  }
}
