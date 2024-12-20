<script lang="ts">
  import { repo } from "#/settings.json"

  async function updateActions() {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    return await res.json()
  }

  let actions = updateActions()
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sakura.css/css/sakura.css" type="text/css">
</svelte:head>

<h1>nixpkgs-reviewd</h1>

<p>Solução para disparar instâncias do nixpkgs-review através do Telegram</p>

<h2>Ongoing tasks <button onclick="{() => actions = updateActions()}">Refresh</button></h2>

{#await actions}
  <p>Loading...</p>
{:then actionsData}
<ul>
{#each actionsData.workflow_runs as action}
  {#if action.path == '.github/workflows/nixpkgs-review.yml'}
    <li>
      <a target="_blank" href="{action.html_url}">
        { action.name } ({action.status}, {action.conclusion})
      </a>
    </li>
  {/if}
{/each}
</ul>
{:catch error}
  <p color="red">Error { error }</p>
{/await}
