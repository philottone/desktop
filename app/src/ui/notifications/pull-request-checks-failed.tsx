import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { RepositoryWithGitHubRepository } from '../../models/repository'
import { PullRequest } from '../../models/pull-request'
import { Dispatcher } from '../dispatcher'
// import { CICheckRunDialog } from './ci-check-run-dialog'

interface IPullRequestChecksFailedProps {
  readonly dispatcher: Dispatcher
  readonly shouldChangeRepository: boolean
  readonly repository: RepositoryWithGitHubRepository
  readonly pullRequest: PullRequest
  readonly onSubmit: () => void
  readonly onDismissed: () => void
}

interface IPullRequestChecksFailedState {
  readonly loading: boolean
}

/**
 * Dialog prompts the user the passphrase of an SSH key.
 */
export class PullRequestChecksFailed extends React.Component<
  IPullRequestChecksFailedProps,
  IPullRequestChecksFailedState
> {
  public constructor(props: IPullRequestChecksFailedProps) {
    super(props)
    this.state = { loading: false }
  }

  public render() {
    let okButtonTitle = __DARWIN__
      ? 'Switch to Pull Request'
      : 'Switch to pull request'

    if (this.props.shouldChangeRepository) {
      okButtonTitle = __DARWIN__
        ? 'Switch to Repository and Pull Request'
        : 'Switch to repository and pull request'
    }

    const dialogTitle = __DARWIN__
      ? 'Pull Request Checks Failed'
      : 'Pull request checks failed'

    return (
      <Dialog
        id="pull-request-checks-failed"
        type="normal"
        title={dialogTitle}
        dismissable={false}
        onSubmit={this.props.onSubmit}
        onDismissed={this.props.onDismissed}
        loading={this.state.loading}
      >
        <DialogContent>
          <Row>
            <span style={{ display: 'inline-block' }}>
              Some checks failed in your pull request{' '}
              <span style={{ fontWeight: 'bold' }}>
                {this.props.pullRequest.title}
              </span>{' '}
              <span style={{ fontWeight: 'bold', color: 'rgb(87, 96, 106)' }}>
                #{this.props.pullRequest.pullRequestNumber}
              </span>
            </span>
          </Row>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            onCancelButtonClick={this.props.onDismissed}
            cancelButtonText="Dismiss"
            okButtonText={okButtonTitle}
            onOkButtonClick={this.onSubmit}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const { dispatcher, repository, pullRequest } = this.props

    this.setState({ loading: true })
    await dispatcher.selectRepository(repository)
    await dispatcher.checkoutPullRequest(repository, pullRequest)
    this.setState({ loading: false })

    this.props.onDismissed()
  }
}
