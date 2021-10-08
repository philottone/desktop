import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { RepositoryWithGitHubRepository } from '../../models/repository'
import { PullRequest } from '../../models/pull-request'
import { CICheckRunList } from '../branches/ci-check-run-list'
import { Dispatcher } from '../dispatcher'

interface IPullRequestChecksFailedProps {
  readonly dispatcher: Dispatcher
  readonly shouldChangeRepository: boolean
  readonly repository: RepositoryWithGitHubRepository
  readonly pullRequest: PullRequest
  readonly onSubmit: () => void
  readonly onDismissed: () => void
}

/**
 * Dialog prompts the user the passphrase of an SSH key.
 */
export class PullRequestChecksFailed extends React.Component<
  IPullRequestChecksFailedProps
> {
  public render() {
    let okButtonTitle = __DARWIN__ ? 'Switch to Branch' : 'Switch to branch'

    if (this.props.shouldChangeRepository) {
      okButtonTitle = __DARWIN__
        ? 'Switch to Repository and Branch'
        : 'Switch to repository and branch'
    }

    return (
      <Dialog
        id="pull-request-checks-failed"
        type="normal"
        title="PR run failed"
        dismissable={false}
        onSubmit={this.props.onSubmit}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>
          <Row>
            Some checks failed in your pull request '
            {this.props.pullRequest.title}'
          </Row>
          <div>
            <CICheckRunList
              prNumber={this.props.pullRequest.pullRequestNumber}
              branchName={this.props.pullRequest.head.ref}
              dispatcher={this.props.dispatcher}
              repository={this.props.repository.gitHubRepository}
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            onCancelButtonClick={this.props.onDismissed}
            cancelButtonText="Dismiss"
            okButtonText={okButtonTitle}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
