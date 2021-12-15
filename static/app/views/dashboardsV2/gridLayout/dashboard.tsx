import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Component, createRef} from 'react';
import {Layout, Responsive, WidthProvider} from 'react-grid-layout';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  openAddDashboardWidgetModal,
  openDashboardWidgetLibraryModal,
} from 'sentry/actionCreators/modal';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import {GlobalSelection, Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {uniqueId} from 'sentry/utils/guid';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from 'sentry/views/dashboardsV2/addWidget';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  MAX_WIDGETS,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import {DataSet} from 'sentry/views/dashboardsV2/widget/utils';

import SortableWidget from './sortableWidget';

export const DRAG_HANDLE_CLASS = 'widget-drag';
const WIDGET_PREFIX = 'grid-item';
const NUM_DESKTOP_COLS = 6;
const NUM_MOBILE_COLS = 2;
const ROW_HEIGHT = 120;
const WIDGET_MARGINS: [number, number] = [16, 16];
const ADD_BUTTON_POSITION = {
  x: 0,
  y: Number.MAX_VALUE,
  w: 2,
  h: 1,
  isResizable: false,
};
const DEFAULT_WIDGET_WIDTH = 2;
const MOBILE_BREAKPOINT = parseInt(theme.breakpoints[0], 10);
const BREAKPOINTS = {mobile: 0, desktop: MOBILE_BREAKPOINT};
const COLUMNS = {mobile: NUM_MOBILE_COLS, desktop: NUM_DESKTOP_COLS};

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: GlobalSelection;
  isEditing: boolean;
  router: InjectedRouter;
  location: Location;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
  onSetWidgetToBeUpdated: (widget: Widget) => void;
  handleAddLibraryWidgets: (widgets: Widget[]) => void;
  paramDashboardId?: string;
  newWidget?: Widget;
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
};

type State = {
  isMobile: boolean;
};

class Dashboard extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.getRef = this.getRef.bind(this);
  }

  state = {
    isMobile: false,
  };

  async componentDidMount() {
    const {isEditing} = this.props;
    // Load organization tags when in edit mode.
    if (isEditing) {
      this.fetchTags();
    }
    this.addNewWidget();
  }

  async componentDidUpdate(prevProps: Props) {
    const {isEditing, newWidget} = this.props;

    // Load organization tags when going into edit mode.
    // We use tags on the add widget modal.
    if (prevProps.isEditing !== isEditing && isEditing) {
      this.fetchTags();
    }
    if (newWidget !== prevProps.newWidget) {
      this.addNewWidget();
    }
  }

  // Used for retreiving width of the grid container
  // because onLayoutChange can trigger before we can set
  // the mobile breakpoint state
  private gridContainer = createRef<HTMLDivElement>();

  getRef(el) {
    this.gridContainer = el;
    return this.gridContainer;
  }

  async addNewWidget() {
    const {api, organization, newWidget} = this.props;
    if (newWidget) {
      try {
        await validateWidget(api, organization.slug, newWidget);
        this.handleAddComplete(newWidget);
      } catch (error) {
        // Don't do anything, widget isn't valid
        addErrorMessage(error);
      }
    }
  }

  fetchTags() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
  }

  handleStartAdd = () => {
    const {organization, dashboard, selection, handleAddLibraryWidgets} = this.props;

    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.opened', {
      organization,
    });
    if (organization.features.includes('widget-library')) {
      openDashboardWidgetLibraryModal({
        organization,
        dashboard,
        onAddWidget: (widgets: Widget[]) => handleAddLibraryWidgets(widgets),
      });
      return;
    }
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      selection,
      onAddWidget: this.handleAddComplete,
      source: DashboardWidgetSource.DASHBOARDS,
    });
  };

  handleOpenWidgetBuilder = () => {
    const {router, paramDashboardId, organization, location} = this.props;
    if (paramDashboardId) {
      router.push({
        pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/new/`,
        query: {
          ...location.query,
          dataSet: DataSet.EVENTS,
        },
      });
      return;
    }
    router.push({
      pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
      query: {
        ...location.query,
        dataSet: DataSet.EVENTS,
      },
    });
  };

  handleAddComplete = (widget: Widget) => {
    this.props.onUpdate([...this.props.dashboard.widgets, assignTempId(widget)]);
  };

  handleUpdateComplete = (prevWidget: Widget) => (nextWidget: Widget) => {
    const nextList = [...this.props.dashboard.widgets];
    const updateIndex = nextList.indexOf(prevWidget);
    nextList[updateIndex] = {...nextWidget, tempId: prevWidget.tempId};
    this.props.onUpdate(nextList);
  };

  handleDeleteWidget = (widgetToDelete: Widget) => () => {
    const nextList = this.props.dashboard.widgets.filter(
      widget => widget !== widgetToDelete
    );
    this.props.onUpdate(nextList);
  };

  handleEditWidget = (widget: Widget, index: number) => () => {
    const {
      organization,
      dashboard,
      selection,
      router,
      location,
      paramDashboardId,
      onSetWidgetToBeUpdated,
    } = this.props;

    if (organization.features.includes('metrics')) {
      onSetWidgetToBeUpdated(widget);

      if (paramDashboardId) {
        router.push({
          pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/${index}/edit/`,
          query: {
            ...location.query,
            dataSet: DataSet.EVENTS,
          },
        });
        return;
      }
      router.push({
        pathname: `/organizations/${organization.slug}/dashboards/new/widget/${index}/edit/`,
        query: {
          ...location.query,
          dataSet: DataSet.EVENTS,
        },
      });
    }

    trackAdvancedAnalyticsEvent('dashboards_views.edit_widget_modal.opened', {
      organization,
    });
    const modalProps = {
      organization,
      widget,
      selection,
      onAddWidget: this.handleAddComplete,
      onUpdateWidget: this.handleUpdateComplete(widget),
    };
    openAddDashboardWidgetModal({
      ...modalProps,
      dashboard,
      source: DashboardWidgetSource.DASHBOARDS,
    });
  };

  renderWidget(widget: Widget, index: number) {
    const {isMobile} = this.state;
    const {isEditing} = this.props;

    const key = constructGridItemKey(widget);
    const dragId = key;

    return (
      <GridItem key={key} data-grid={getDefaultPosition(index, widget.displayType)}>
        <SortableWidget
          widget={widget}
          dragId={dragId}
          isEditing={isEditing}
          onDelete={this.handleDeleteWidget(widget)}
          onEdit={this.handleEditWidget(widget, index)}
          hideDragHandle={isMobile}
        />
      </GridItem>
    );
  }

  onLayoutChange = newLayout => {
    const {onLayoutChange} = this.props;

    if (!this?.gridContainer?.current?.offsetWidth) {
      return;
    }

    if (this.gridContainer.current.offsetWidth < MOBILE_BREAKPOINT) {
      this.setState({isMobile: true});
      return;
    }

    this.setState({isMobile: false});
    const isNotAddButton = ({i}) => i !== ADD_WIDGET_BUTTON_DRAG_ID;
    onLayoutChange(newLayout.filter(isNotAddButton));
  };

  render() {
    const {isMobile} = this.state;
    const {
      isEditing,
      dashboard: {widgets},
      organization,
      layout,
    } = this.props;

    const canModifyLayout = !isMobile && isEditing;

    return (
      <div ref={this.getRef}>
        <GridLayout
          breakpoints={BREAKPOINTS}
          cols={COLUMNS}
          rowHeight={ROW_HEIGHT}
          margin={WIDGET_MARGINS}
          draggableHandle={`.${DRAG_HANDLE_CLASS}`}
          layouts={{desktop: layout, mobile: getMobileLayout(layout, widgets)}}
          onLayoutChange={this.onLayoutChange}
          isDraggable={canModifyLayout}
          isResizable={canModifyLayout}
          isBounded
        >
          {widgets.map((widget, index) => this.renderWidget(widget, index))}
          {isEditing && widgets.length < MAX_WIDGETS && (
            <div key={ADD_WIDGET_BUTTON_DRAG_ID} data-grid={ADD_BUTTON_POSITION}>
              <AddWidget
                orgFeatures={organization.features}
                onAddWidget={this.handleStartAdd}
                onOpenWidgetBuilder={this.handleOpenWidgetBuilder}
              />
            </div>
          )}
        </GridLayout>
      </div>
    );
  }
}

export default withApi(withGlobalSelection(Dashboard));

const GridItem = styled('div')`
  .react-resizable-handle {
    z-index: 1;
  }
`;

// HACK: to stack chart tooltips above other grid items
const GridLayout = styled(WidthProvider(Responsive))`
  .react-grid-item:hover {
    z-index: 10;
  }
`;

export function constructGridItemKey(widget: Widget) {
  return `${WIDGET_PREFIX}-${widget.id ?? widget.tempId}`;
}

export function assignTempId(widget) {
  if (widget.id ?? widget.tempId) {
    return widget;
  }

  return {...widget, tempId: uniqueId()};
}

/**
 * Naive positioning for widgets assuming no resizes.
 */
function getDefaultPosition(index: number, displayType: DisplayType) {
  return {
    x: (DEFAULT_WIDGET_WIDTH * index) % NUM_DESKTOP_COLS,
    y: Number.MAX_VALUE,
    w: DEFAULT_WIDGET_WIDTH,
    h: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
    minH: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  };
}

function getMobileLayout(desktopLayout, widgets) {
  if (desktopLayout.length === 0) {
    // Initial case where the user has no layout saved, but
    // dashboard has widgets
    return [];
  }

  // Filter out layouts to only those that haven't been deleted
  const expectedGridKeys = new Set(widgets.map(constructGridItemKey));
  const survivingLayouts = desktopLayout.filter(({i}) => expectedGridKeys.has(i));

  const layoutWidgetPairs = zip(survivingLayouts, widgets);

  // Sort by y and then subsort by x
  const sorted = sortBy(layoutWidgetPairs, ['0.y', '0.x']) as [Layout, Widget][];

  const mobileLayout = sorted.map(([layout, widget], index) => ({
    ...layout,
    x: 0,
    y: index * 2,
    w: 2,
    h: widget.displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  }));

  return mobileLayout;
}
