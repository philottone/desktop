import {
  Repository,
  isRepositoryWithGitHubRepository,
  RepositoryWithGitHubRepository,
} from '../../models/repository'
import { remote } from 'electron'
import { PullRequest, PullRequestRef } from '../../models/pull-request'

type OnChecksFailedCallback = (
  repository: RepositoryWithGitHubRepository,
  pullRequest: PullRequest
  // TODO: workflow run too?
) => void

export class NotificationsStore {
  private fakePollingTimeoutId: number | null = null
  private repository: RepositoryWithGitHubRepository | null = null
  private onChecksFailedCallback: OnChecksFailedCallback | null = null

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

    const repository = this.repository
    const workflowName = 'CI'
    const prName = 'Bump Git to 2.32.0 and Git LFS to 2.13.3'
    const commitSha = 'b0e713a'
    const NOTIFICATION_TITLE = 'PR run failed'
    const NOTIFICATION_BODY = `${workflowName} - ${prName} (${commitSha})\nSome jobs were not successful.`
    const notification = new remote.Notification({
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY,
    })

    const pullRequestRef = new PullRequestRef(
      'bump-git',
      'fabada',
      repository.gitHubRepository
    )
    const baseRef = new PullRequestRef(
      'development',
      'fabada',
      repository.gitHubRepository
    )
    const pullRequest = new PullRequest(
      new Date(),
      prName,
      13013,
      pullRequestRef,
      baseRef,
      'sergiou87',
      false
    )

    notification.on('click', () => {
      this.onChecksFailedCallback?.(repository, pullRequest)
    })

    notification.show()
  }

  public onChecksFailedNotification(callback: OnChecksFailedCallback) {
    this.onChecksFailedCallback = callback
  }
}
