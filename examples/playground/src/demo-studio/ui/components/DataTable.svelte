<script lang="ts">
  type DataTableProps = {
    columns?: string[];
    rows?: Array<Array<string>>;
  };

  let { columns = [], rows = [] }: DataTableProps = $props();
</script>

<div>
  <table>
    <thead>
      <tr>
        {#each columns as column}
          <th scope="col">{column}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr>
          {#each columns as _, index}
            <td data-label={columns[index]}>{row[index] ?? ''}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  div {
    overflow: auto;
    border: 1px solid var(--gf-line);
    border-radius: var(--gf-radius-card);
    background: var(--gf-raised);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    color: var(--gf-body);
    font-size: 13px;
    line-height: 1.35;
  }

  th,
  td {
    min-height: 34px;
    border-bottom: 1px solid var(--gf-line);
    padding: 10px 12px;
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
  }

  th {
    color: var(--gf-muted);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.04em;
    line-height: 1;
    text-transform: uppercase;
  }

  td {
    color: var(--gf-body);
    font-weight: 500;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  @media (max-width: 420px) {
    div {
      overflow: hidden;
    }

    table,
    tbody,
    tr,
    td {
      display: block;
    }

    table {
      min-width: 0;
    }

    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      border: 0;
      padding: 0;
      white-space: nowrap;
    }

    tbody tr {
      border-bottom: 1px solid var(--gf-line);
      padding: 6px 0;
    }

    tbody tr:last-child {
      border-bottom: 0;
    }

    td {
      display: grid;
      grid-template-columns: minmax(74px, 38%) minmax(0, 1fr);
      align-items: start;
      gap: 8px;
      min-height: 0;
      border-bottom: 0;
      padding: 4px 10px;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    td::before {
      content: attr(data-label);
      color: var(--gf-muted);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.04em;
      line-height: 1.25;
      text-transform: uppercase;
    }
  }
</style>
