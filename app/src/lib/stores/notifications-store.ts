import {
  Repository,
  isRepositoryWithGitHubRepository,
  RepositoryWithGitHubRepository,
} from '../../models/repository'
import { remote } from 'electron'
import { PullRequest, PullRequestRef } from '../../models/pull-request'
import {
  API,
  IAPIPullRequest,
  APICheckConclusion,
  APICheckStatus,
} from '../api'
import {
  createCombinedCheckFromChecks,
  getLatestCheckRunsByName,
  apiStatusToRefCheck,
  apiCheckRunToRefCheck,
  IRefCheck,
  isSuccess,
} from '../ci-checks/ci-checks'
import { AccountsStore } from './accounts-store'
import { getCommit } from '../git'
import { GitHubRepository } from '../../models/github-repository'

type OnChecksFailedCallback = (
  repository: RepositoryWithGitHubRepository,
  pullRequest: PullRequest,
  commitMessage: string,
  commitSha: string,
  checkRuns: ReadonlyArray<IRefCheck>
) => void

type LastCheckedPullRequestEntry = {
  readonly headSha: string
  readonly checkStatus: APICheckStatus
  readonly checkConclusion: APICheckConclusion | null
}

type LastCheckedPullRequests = Map<number, LastCheckedPullRequestEntry>

export class NotificationsStore {
  private fakePollingTimeoutId: number | null = null
  private repository: RepositoryWithGitHubRepository | null = null
  private onChecksFailedCallback: OnChecksFailedCallback | null = null
  private accountsStore: AccountsStore
  private lastCheckDate: Date | null = null
  private lastCheckedPullRequests: LastCheckedPullRequests = new Map()

  public constructor(accountsStore: AccountsStore) {
    this.accountsStore = accountsStore
  }

  private unsubscribe() {
    if (this.fakePollingTimeoutId !== null) {
      window.clearTimeout(this.fakePollingTimeoutId)
    }
  }

  private subscribe(repository: RepositoryWithGitHubRepository) {
    this.unsubscribe()

    this.repository = repository

    this.fakePollingTimeoutId = window.setTimeout(async () => {
      if (this.repository === null) {
        return
      }

      const { gitHubRepository } = repository
      const { name, owner } = gitHubRepository

      const account = await this.getAccountForRepository(gitHubRepository)
      const api = await this.getAPIForRepository(
        this.repository.gitHubRepository
      )

      if (account === null || api === null) {
        return
      }

      const pullRequests = await api.fetchUpdatedOpenPullRequestsWithHeadFromUser(
        owner.login,
        name,
        this.lastCheckDate ?? new Date(0),
        account.login,
        3
      )

      debugger

      this.lastCheckDate = new Date()

      this.checkPullRequests(pullRequests)

      //this.postChecksFailedNotification()
      // this.subscribe(repository)
      // eslint-disable-next-line insecure-random
    }, 1000) //Math.random() * 5000 + 5000)
  }

  public async checkPullRequests(pullRequests: ReadonlyArray<IAPIPullRequest>) {
    const repository = this.repository
    if (repository === null) {
      return
    }

    const checkedPullRequests: LastCheckedPullRequests = new Map()

    for (const pr of pullRequests) {
      const { number: prNumber, head } = pr
      const previousCheckedPR = this.lastCheckedPullRequests.get(prNumber)

      // Only check PRs if:
      // - We haven't checked them yet
      // - Last time we checked, the PR check status wasn't completed
      // - If it was completed, check it again if the head changed
      if (
        previousCheckedPR !== undefined &&
        previousCheckedPR.checkStatus === APICheckStatus.Completed &&
        previousCheckedPR.headSha === head.sha
      ) {
        continue
      }

      const checks = await this.getChecksForRef(repository, pr.head.ref)
      if (checks === null) {
        continue
      }

      const allPRChecksCompleted = checks.checks.every(
        check => check.status === APICheckStatus.Completed
      )

      if (!allPRChecksCompleted) {
        checkedPullRequests.set(prNumber, {
          headSha: head.sha,
          checkStatus: APICheckStatus.InProgress,
          checkConclusion: null,
        })
        continue
      }

      let prCheckConclusion = APICheckConclusion.Success

      for (const check of checks.checks) {
        if (check.conclusion === null || isSuccess(check)) {
          continue
        }

        this.postChecksFailedNotification(
          pr,
          checks.checks,
          checks.sha,
          checks.commitMessage
        )

        prCheckConclusion = APICheckConclusion.Failure
        break
      }

      checkedPullRequests.set(prNumber, {
        headSha: head.sha,
        checkStatus: APICheckStatus.Completed,
        checkConclusion: prCheckConclusion,
      })
    }

    this.lastCheckedPullRequests = checkedPullRequests
  }

  public selectRepository(repository: Repository) {
    this.unsubscribe()

    if (!isRepositoryWithGitHubRepository(repository)) {
      return
    }

    this.subscribe(repository)
  }

  private async getAccountForRepository(repository: GitHubRepository) {
    const { endpoint } = repository

    // TODO: make this in a cleaner way
    const accounts = await this.accountsStore.getAll()
    return accounts.find(a => a.endpoint === endpoint) ?? null
  }

  private async getAPIForRepository(repository: GitHubRepository) {
    const account = await this.getAccountForRepository(repository)

    if (account === null) {
      return null
    }

    return API.fromAccount(account)
  }

  private postChecksFailedNotification(
    apiPullRequest: IAPIPullRequest,
    checks: ReadonlyArray<IRefCheck>,
    sha: string,
    commitMessage: string
  ) {
    if (this.repository === null) {
      return
    }

    const repository = this.repository

    if (repository.alias !== 'desktop-2') {
      return
    }

    const workflowName = 'CI'
    const prName = 'IGNORE: testing check runs Failing unit test'
    const commitSha = 'ef0edb8'
    const NOTIFICATION_TITLE = 'PR run failed'
    const NOTIFICATION_BODY = `${workflowName} - ${prName} (${commitSha})\nSome jobs were not successful.`
    const notification = new remote.Notification({
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_BODY,
    })

    const headRef = new PullRequestRef(
      apiPullRequest.head.ref,
      apiPullRequest.head.sha,
      repository.gitHubRepository
    )
    const baseRef = new PullRequestRef(
      apiPullRequest.base.ref,
      apiPullRequest.base.sha,
      repository.gitHubRepository
    )
    const pullRequest = new PullRequest(
      new Date(apiPullRequest.created_at),
      apiPullRequest.title,
      apiPullRequest.number,
      headRef,
      baseRef,
      apiPullRequest.user.login,
      apiPullRequest.draft ?? false
    )

    notification.on('click', () => {
      this.onChecksFailedCallback?.(
        repository,
        pullRequest,
        commitMessage,
        sha,
        checks
      )
    })

    notification.show()
  }

  private async getChecksForRef(
    repository: RepositoryWithGitHubRepository,
    ref: string
  ) {
    const { gitHubRepository } = repository
    const { owner, name } = gitHubRepository

    const api = await this.getAPIForRepository(gitHubRepository)

    if (api === null) {
      return null
    }

    const [statuses, checkRuns] = await Promise.all([
      api.fetchCombinedRefStatus(owner.login, name, ref),
      api.fetchRefCheckRuns(owner.login, name, ref),
    ])

    const checks = new Array<IRefCheck>()

    if (statuses === null || checkRuns === null) {
      return null
    }

    let commitMessage: string

    // Try to get the commit message first from the repository and, if it's not
    // there, then fall back to the API.
    const commit = await getCommit(repository, statuses.sha)
    if (commit !== null) {
      commitMessage = commit.summary
    } else {
      const apiCommit = await api.fetchCommit(owner.login, name, statuses.sha)

      if (apiCommit === null) {
        return null
      }

      commitMessage = apiCommit.commit.message
    }

    if (statuses !== null) {
      checks.push(...statuses.statuses.map(apiStatusToRefCheck))
    }

    if (checkRuns !== null) {
      const latestCheckRunsByName = getLatestCheckRunsByName(
        checkRuns.check_runs
      )
      checks.push(...latestCheckRunsByName.map(apiCheckRunToRefCheck))
    }

    const check = createCombinedCheckFromChecks(checks)

    if (check === null || check.checks.length === 0) {
      return null
    }

    return {
      checks: check.checks,
      commitMessage,
      sha: statuses.sha,
    }
  }

  public onChecksFailedNotification(callback: OnChecksFailedCallback) {
    this.onChecksFailedCallback = callback
  }
}
