import React, {PropTypes, Component} from 'react'

import SourceIndicator from 'shared/components/SourceIndicator'
import AlertsTable from 'src/alerts/components/AlertsTable'
import NoKapacitorError from 'shared/components/NoKapacitorError'
import CustomTimeRangeDropdown from 'shared/components/CustomTimeRangeDropdown'
import FancyScrollbar from 'shared/components/FancyScrollbar'

import {getAlerts} from 'src/alerts/apis'
import AJAX from 'utils/ajax'

import _ from 'lodash'
import moment from 'moment'

import timeRanges from 'hson!shared/data/timeRanges.hson'

class AlertsApp extends Component {
  constructor(props) {
    super(props)

    const lowerInSec = props.timeRange
      ? timeRanges.find(tr => tr.lower === props.timeRange.lower).seconds
      : undefined

    const oneDayInSec = 86400

    this.state = {
      loading: true,
      hasKapacitor: false,
      alerts: [],
      isTimeOpen: false,
      timeRange: {
        upper: moment().format(),
        lower: moment().subtract(lowerInSec || oneDayInSec, 'seconds').format(),
      },
    }

    this.fetchAlerts = ::this.fetchAlerts
    this.renderSubComponents = ::this.renderSubComponents
    this.handleToggleTime = ::this.handleToggleTime
    this.handleCloseTime = ::this.handleCloseTime
    this.handleApplyTime = ::this.handleApplyTime
  }

  // TODO: show a loading screen until we figure out if there is a kapacitor and fetch the alerts
  componentDidMount() {
    const {source} = this.props
    AJAX({
      url: source.links.kapacitors,
      method: 'GET',
    }).then(({data}) => {
      if (data.kapacitors[0]) {
        this.setState({hasKapacitor: true})

        this.fetchAlerts()
      } else {
        this.setState({loading: false})
      }
    })
  }

  componentDidUpdate(prevProps, prevState) {
    if (!_.isEqual(prevState.timeRange, this.state.timeRange)) {
      this.fetchAlerts()
    }
  }

  fetchAlerts() {
    getAlerts(
      this.props.source.links.proxy,
      this.state.timeRange
    ).then(resp => {
      const results = []

      const alertSeries = _.get(resp, ['data', 'results', '0', 'series'], [])
      if (alertSeries.length === 0) {
        this.setState({loading: false, alerts: []})
        return
      }

      const timeIndex = alertSeries[0].columns.findIndex(col => col === 'time')
      const hostIndex = alertSeries[0].columns.findIndex(col => col === 'host')
      const valueIndex = alertSeries[0].columns.findIndex(
        col => col === 'value'
      )
      const levelIndex = alertSeries[0].columns.findIndex(
        col => col === 'level'
      )
      const nameIndex = alertSeries[0].columns.findIndex(
        col => col === 'alertName'
      )

      alertSeries[0].values.forEach(s => {
        results.push({
          time: `${s[timeIndex]}`,
          host: s[hostIndex],
          value: `${s[valueIndex]}`,
          level: s[levelIndex],
          name: `${s[nameIndex]}`,
        })
      })
      this.setState({loading: false, alerts: results})
    })
  }

  renderSubComponents() {
    const {source, isWidget} = this.props
    return this.state.hasKapacitor
      ? <AlertsTable
          source={source}
          alerts={this.state.alerts}
          shouldNotBeFilterable={isWidget}
        />
      : <NoKapacitorError source={source} />
  }

  handleToggleTime() {
    this.setState({isTimeOpen: !this.state.isTimeOpen})
  }

  handleCloseTime() {
    this.setState({isTimeOpen: false})
  }

  handleApplyTime(timeRange) {
    this.setState({timeRange})
  }

  render() {
    const {isWidget, source} = this.props
    const {loading, timeRange} = this.state

    if (loading || !source) {
      return <div className="page-spinner" />
    }

    return isWidget
      ? <FancyScrollbar>
          {this.renderSubComponents()}
        </FancyScrollbar>
      : <div className="page">
          <div className="page-header">
            <div className="page-header__container">
              <div className="page-header__left">
                <h1 className="page-header__title">
                  Alert History
                </h1>
              </div>
              <div className="page-header__right">
                <SourceIndicator sourceName={source.name} />
                <CustomTimeRangeDropdown
                  isVisible={this.state.isTimeOpen}
                  onToggle={this.handleToggleTime}
                  onClose={this.handleCloseTime}
                  onApplyTimeRange={this.handleApplyTime}
                  timeRange={timeRange}
                />
              </div>
            </div>
          </div>
          <FancyScrollbar className="page-contents">
            <div className="container-fluid">
              <div className="row">
                <div className="col-md-12">
                  {this.renderSubComponents()}
                </div>
              </div>
            </div>
          </FancyScrollbar>
        </div>
  }
}

const {bool, oneOfType, shape, string} = PropTypes

AlertsApp.propTypes = {
  source: shape({
    id: string.isRequired,
    name: string.isRequired,
    type: string, // 'influx-enterprise'
    links: shape({
      proxy: string.isRequired,
    }).isRequired,
  }),
  timeRange: shape({
    lower: string.isRequired,
    upper: oneOfType([shape(), string]),
  }),
  isWidget: bool,
}

export default AlertsApp
