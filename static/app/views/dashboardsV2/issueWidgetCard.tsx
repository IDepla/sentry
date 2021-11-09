import * as React from 'react';
import LazyLoad from 'react-lazyload';
import {withRouter, WithRouterProps} from 'react-router';
import {useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'app/api';
import {HeaderTitle} from 'app/components/charts/styles';
import ErrorBoundary from 'app/components/errorBoundary';
import {isSelectionEqual} from 'app/components/organizations/globalSelectionHeader/utils';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {IconDelete, IconEdit, IconGrabbable} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import IssueWidgetCardChart from './issueWidgetCardChart';
import IssueWidgetQueries from './issueWidgetQueries';
import {Widget} from './types';

type DraggableProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>;

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  location: Location;
  isEditing: boolean;
  widget: Widget;
  selection: GlobalSelection;
  onDelete: () => void;
  onEdit: () => void;
  isSorting: boolean;
  currentWidgetDragging: boolean;
  showContextMenu?: boolean;
  hideToolbar?: boolean;
  draggableProps?: DraggableProps;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

class WidgetCard extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props): boolean {
    if (
      !isEqual(nextProps.widget, this.props.widget) ||
      !isSelectionEqual(nextProps.selection, this.props.selection) ||
      this.props.isEditing !== nextProps.isEditing ||
      this.props.isSorting !== nextProps.isSorting ||
      this.props.hideToolbar !== nextProps.hideToolbar
    ) {
      return true;
    }
    return false;
  }

  isAllowWidgetsToDiscover() {
    const {organization} = this.props;
    return organization.features.includes('connect-discover-and-dashboards');
  }

  renderToolbar() {
    const {onEdit, onDelete, draggableProps, hideToolbar, isEditing} = this.props;

    if (!isEditing) {
      return null;
    }

    return (
      <ToolbarPanel>
        <IconContainer style={{visibility: hideToolbar ? 'hidden' : 'visible'}}>
          <IconClick>
            <StyledIconGrabbable
              color="textColor"
              {...draggableProps?.listeners}
              {...draggableProps?.attributes}
            />
          </IconClick>
          <IconClick
            data-test-id="widget-edit"
            onClick={() => {
              onEdit();
            }}
          >
            <IconEdit color="textColor" />
          </IconClick>
          <IconClick
            data-test-id="widget-delete"
            onClick={() => {
              onDelete();
            }}
          >
            <IconDelete color="textColor" />
          </IconClick>
        </IconContainer>
      </ToolbarPanel>
    );
  }

  render() {
    const {widget, api, organization, selection, renderErrorMessage, location, router} =
      this.props;
    return (
      <ErrorBoundary
        customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
      >
        <StyledPanel isDragging={false}>
          <WidgetHeader>
            <WidgetTitle>{widget.title}</WidgetTitle>
          </WidgetHeader>
          <LazyLoad once height={200}>
            <IssueWidgetQueries
              api={api}
              organization={organization}
              widget={widget}
              selection={selection}
            >
              {({tableResults, errorMessage, loading}) => {
                return (
                  <React.Fragment>
                    {typeof renderErrorMessage === 'function'
                      ? renderErrorMessage(errorMessage)
                      : null}
                    <IssueWidgetCardChart
                      tableResults={tableResults}
                      errorMessage={errorMessage}
                      loading={loading}
                      location={location}
                      widget={widget}
                      selection={selection}
                      router={router}
                      organization={organization}
                    />
                    {this.renderToolbar()}
                  </React.Fragment>
                );
              }}
            </IssueWidgetQueries>
          </LazyLoad>
        </StyledPanel>
      </ErrorBoundary>
    );
  }
}

export default withApi(withOrganization(withGlobalSelection(withRouter(WidgetCard))));

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;

const StyledPanel = styled(Panel, {
  shouldForwardProp: prop => prop !== 'isDragging',
})<{
  isDragging: boolean;
}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 96px;
`;

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  background-color: ${p => p.theme.overlayBackgroundAlpha};
  border-radius: ${p => p.theme.borderRadius};
`;

const IconContainer = styled('div')`
  display: flex;
  margin: 10px ${space(2)};
  touch-action: none;
`;

const IconClick = styled('div')`
  padding: ${space(1)};

  &:hover {
    cursor: pointer;
  }
`;

const StyledIconGrabbable = styled(IconGrabbable)`
  &:hover {
    cursor: grab;
  }
`;

const WidgetTitle = styled(HeaderTitle)`
  ${overflowEllipsis};
`;

const WidgetHeader = styled('div')`
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
  width: 100%;
  display: flex;
  justify-content: space-between;
`;
