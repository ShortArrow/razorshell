import { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getMessage } from '../languages';
import { loadUrlPolicy, saveUrlPolicy } from '../urlpolicy';
import { MatchType, RuleAction, UrlPolicy, UrlRule, defaultUrlPolicy, findMatchingRuleIndex } from '../urlrules';
import { Select } from './select';

const matchTypes: MatchType[] = ['exact', 'glob', 'regex'];
const ruleActions: RuleAction[] = ['allow', 'deny'];

/**
 * @fn patternRejection
 * @brief Judge a pattern about to be added, naming why it cannot become a rule.
 * @param string pattern - The pattern as typed
 * @param MatchType matchType - The match type selected beside it
 * @return The message to show, or '' when the pattern is acceptable
 */
function patternRejection(pattern: string, matchType: MatchType): string {
  if (pattern.trim() === '') return 'pattern is empty';
  if (matchType !== 'regex') return '';
  try {
    new RegExp(pattern);
    return '';
  } catch {
    return 'invalid regular expression';
  }
}

function swapped(rules: UrlRule[], index: number, target: number): UrlRule[] {
  const next = [...rules];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function actionBadgeClass(action: RuleAction): string {
  return action === 'allow' ? 'badge badge-success' : 'badge badge-error';
}

export function UrlApp() {
  const [policy, setPolicy] = useState<UrlPolicy>(defaultUrlPolicy);
  const [pattern, setPattern] = useState<string>('');
  const [matchType, setMatchType] = useState<MatchType>('exact');
  const [action, setAction] = useState<RuleAction>('deny');
  const [patternError, setPatternError] = useState<string>('');
  const [probe, setProbe] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');

  const probedIndex = probe === '' ? null : findMatchingRuleIndex(probe, policy);
  const probedRule = probedIndex === null ? null : policy.rules[probedIndex];

  useEffect(() => {
    const fetchPolicy = async () => {
      setPolicy(await loadUrlPolicy());
    };
    void fetchPolicy();
  }, []);

  const applyPolicy = (next: UrlPolicy) => {
    setPolicy(next);
    saveUrlPolicy(next)
      .then(() => setSaveError(''))
      .catch(async (failure: unknown) => {
        setSaveError(failure instanceof Error ? failure.message : String(failure));
        // The table showed `next` optimistically. Storage refused it, so the
        // rendered policy is now a claim about state that does not exist;
        // reading storage back is what makes the two agree again. The read
        // must not migrate: migration writes, and whatever refused the save
        // refuses that write too, which would replace the shown failure.
        try {
          setPolicy(await loadUrlPolicy({ migrate: false }));
        } catch {
          // The resync failed as well; the save failure stays on screen.
        }
      });
  };

  const addRule = () => {
    const rejection = patternRejection(pattern, matchType);
    setPatternError(rejection);
    if (rejection !== '') return;
    applyPolicy({ ...policy, rules: [...policy.rules, { pattern, matchType, action }] });
    setPattern('');
  };

  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>URL policy</h2>
      <div className='flex items-center gap-2'>
        <label htmlFor='default-action'>Default policy for URLs matching no rule</label>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_default_policy')()}>
          <Select
            id='default-action'
            className='select-sm'
            value={policy.defaultAction}
            onChange={(e) => applyPolicy({ ...policy, defaultAction: e.target.value as RuleAction })}
          >
            {ruleActions.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </div>
      </div>
      <div className='join w-full'>
        <label className='input input-bordered join-item flex justify-center items-center grow'>
          <input
            type='text'
            id='pattern'
            className={patternError === '' ? 'grow' : 'grow input-error'}
            placeholder='pattern'
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
              setPatternError('');
            }}
          />
        </label>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_match_type')()}>
          <Select
            className='join-item'
            aria-label={getMessage('tooltip_match_type')()}
            value={matchType}
            onChange={(e) => {
              setMatchType(e.target.value as MatchType);
              setPatternError('');
            }}
          >
            {matchTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </div>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_rule_action')()}>
          <Select
            className='join-item'
            aria-label={getMessage('tooltip_rule_action')()}
            value={action}
            onChange={(e) => setAction(e.target.value as RuleAction)}
          >
            {ruleActions.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </div>
        <button className='btn btn-primary join-item' onClick={addRule}>add rule</button>
      </div>
      {patternError === '' ? null : <p className='text-error'>{patternError}</p>}
      <div className='flex items-center gap-2'>
        <div className='tooltip tooltip-top grow' data-tip={getMessage('tooltip_url_probe')()}>
          <input
            type='url'
            data-testid='url-probe-input'
            aria-label={getMessage('tooltip_url_probe')()}
            className='input input-bordered input-sm w-full'
            placeholder='URL to check'
            value={probe}
            onChange={(e) => setProbe(e.target.value)}
          />
        </div>
        <div className='flex justify-start items-center min-w-32 h-8'>
          {
            probe === ''
              ? null
              : <span data-testid='url-probe-result' className={actionBadgeClass(probedRule ? probedRule.action : policy.defaultAction)}>
                {probedRule ? probedRule.action : `default: ${policy.defaultAction}`}
              </span>
          }
        </div>
      </div>
      <table className='table'>
        <thead>
          <tr>
            <th>
              <span className='tooltip tooltip-top' data-tip={getMessage('tooltip_rule_order')()}>#</span>
            </th>
            <th>action</th>
            <th>match</th>
            <th>pattern</th>
            <th><span className='sr-only'>rule actions</span></th>
          </tr>
        </thead>
        <tbody>
          {policy.rules.length === 0
            ? <tr><td colSpan={5} className='text-center opacity-80'>no rules</td></tr>
            : null}
          {
            policy.rules.map((rule, index) => {
              const matched = index === probedIndex;
              return <tr key={index} className={matched ? 'bg-base-200' : undefined} data-matched={matched ? 'true' : undefined}>
                <td>{index + 1}</td>
                <td><span className={actionBadgeClass(rule.action)}>{rule.action}</span></td>
                <td><span className='badge badge-outline'>{rule.matchType}</span></td>
                <td><code>{rule.pattern}</code></td>
                <td className='flex items-center gap-2'>
                  <button
                    className='btn btn-outline btn-xs'
                    aria-label={`move rule ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => applyPolicy({ ...policy, rules: swapped(policy.rules, index, index - 1) })}>
                    <ChevronUpIcon className='w-4 h-4' />
                  </button>
                  <button
                    className='btn btn-outline btn-xs'
                    aria-label={`move rule ${index + 1} down`}
                    disabled={index === policy.rules.length - 1}
                    onClick={() => applyPolicy({ ...policy, rules: swapped(policy.rules, index, index + 1) })}>
                    <ChevronDownIcon className='w-4 h-4' />
                  </button>
                  <button
                    className='btn btn-outline btn-xs btn-error'
                    aria-label={`delete rule ${index + 1}`}
                    onClick={() => applyPolicy({ ...policy, rules: policy.rules.filter((_, i) => i !== index) })}>
                    <XMarkIcon className='w-4 h-4' />
                  </button>
                </td>
              </tr>;
            })
          }
        </tbody>
      </table>
      <div className='min-h-6' data-testid='url-save-error'>
        {saveError === '' ? null : <span className='text-error'>{saveError}</span>}
      </div>
    </div>
  </>;
}
