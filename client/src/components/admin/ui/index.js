/*
 * The admin UI kit. Every admin screen is built from these components
 * (styles in styles/adminKit.css, loaded by AdminLayout). Pages should not
 * hand-write buttons, inputs, tables, cards or dialogs.
 *
 *   import { Page, PageHeader, Card, Button, DataTable, Field, Input, useConfirm } from '../../components/admin/ui';
 *
 * Layout      Page, PageHeader (pass icon = the page's menu icon), Card, SideLayout, Grid, Stack, KeyValue
 * Look        the owner likes the Customers screen's cards/search/table: flat white cards with light borders,
 *             StatCards with a plain red icon and uppercase label, a full-width SearchInput (block), table
 *             headers with small icons (column.icon), Avatar initials. Header = PageHeader panel with icon.
 * Actions     Button, IconButton, Actions
 * Forms       Field, FieldRow, Input, Textarea, Select (kit dropdown, native-like API), NativeSelect, Checkbox, Switch, FormActions,
 *             OptionCards (radio group as cards with icon + explanation)
 * Navigation  Tabs, Segmented, PageTabs (section tabs with icons, counts, red underline), SearchInput, Toolbar
 * Data        DataTable, CellText, RowActions, StatGrid, StatCard
 * Feedback    Pill, Avatar, EmptyState, Banner, Skeleton, SkeletonRows, Spinner
 * Dialogs     Modal, ConfirmDialog, useConfirm, Popover (menus anchored to a button; never clipped by tables/cards)
 * Media       ImageDrop
 * Toasts      useToast() from context/ToastContext: toast(message, 'success' | 'error' | 'warning' | 'info')
 */
export { Page, PageHeader, Card, SideLayout, Grid, Stack, KeyValue } from './Layout';
export { Button, IconButton, Actions } from './Button';
export { Field, FieldRow, Input, Textarea, Select, NativeSelect, Checkbox, Switch, FormActions, OptionCards } from './Form';
export { Tabs, Segmented, PageTabs, SearchInput, Toolbar } from './Navigation';
export { default as DataTable, CellText, RowActions } from './DataTable';
export { StatGrid, StatCard } from './Stats';
export { Pill, Avatar, EmptyState, Banner, Skeleton, SkeletonRows, Spinner } from './Feedback';
export { Modal, ConfirmDialog } from './Modal';
export { Popover } from './Popover';
export { useConfirm } from './useConfirm';
export { ImageDrop } from './ImageDrop';
