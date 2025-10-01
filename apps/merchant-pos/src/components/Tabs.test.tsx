import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import Tabs from './Tabs';

describe('Tabs', () => {
  afterEach(() => {
    cleanup();
  });

  function renderTabs() {
    render(
      <Tabs defaultValue="overview">
        <Tabs.List aria-label="Account sections">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="payments">Payments</Tabs.Tab>
          <Tabs.Tab value="reports">Reports</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panels>
          <Tabs.Panel value="overview">Overview content</Tabs.Panel>
          <Tabs.Panel value="payments">Payments content</Tabs.Panel>
          <Tabs.Panel value="reports">Reports content</Tabs.Panel>
        </Tabs.Panels>
      </Tabs>,
    );
  }

  it('sets up tablist semantics and links tabs with panels', () => {
    renderTabs();

    const tablist = screen.getByRole('tablist', { name: 'Account sections' });
    expect(tablist).toBeInTheDocument();

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    const paymentsTab = screen.getByRole('tab', { name: 'Payments' });
    const overviewPanel = screen.getByRole('tabpanel', { name: 'Overview' });

    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(overviewTab).toHaveAttribute('tabindex', '0');
    expect(paymentsTab).toHaveAttribute('aria-selected', 'false');
    expect(paymentsTab).toHaveAttribute('tabindex', '-1');

    expect(overviewTab).toHaveAttribute('aria-controls', overviewPanel.id);
    expect(overviewPanel).toHaveAttribute('aria-labelledby', overviewTab.id);
    expect(overviewPanel).toBeVisible();
    expect(screen.getByText('Payments content')).not.toBeVisible();
  });

  it('supports clicking to activate tabs and updates panels', () => {
    renderTabs();

    const paymentsTab = screen.getByRole('tab', { name: 'Payments' });
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });

    fireEvent.click(paymentsTab);

    expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
    expect(paymentsTab).toHaveAttribute('tabindex', '0');
    expect(paymentsTab).toHaveFocus();
    expect(overviewTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Payments content')).toBeVisible();
    expect(screen.getByText('Overview content')).not.toBeVisible();
  });

  it('supports arrow key roving focus and Home/End behaviour', () => {
    renderTabs();

    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    const paymentsTab = screen.getByRole('tab', { name: 'Payments' });
    const reportsTab = screen.getByRole('tab', { name: 'Reports' });

    paymentsTab.focus();
    fireEvent.keyDown(paymentsTab, { key: 'ArrowLeft' });

    expect(overviewTab).toHaveFocus();
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(overviewTab, { key: 'End' });
    expect(reportsTab).toHaveFocus();
    expect(reportsTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(reportsTab, { key: 'Home' });
    expect(overviewTab).toHaveFocus();
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  });
});
