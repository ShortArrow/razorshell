import { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getMessage } from '../languages';
import { loadUrlPolicy, saveUrlPolicy } from '../urlpolicy';
import { MatchType, RuleAction, UrlPolicy, UrlRule, defaultUrlPolicy } from '../urlrules';

const matchTypes: MatchType[] = ['exact', 'glob', 'regex'];
const ruleActions: RuleAction[] = ['allow', 'deny'];

function isValidPattern(pattern: string, matchType: MatchType): boolean {
  if (matchType !== 'regex') return true;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function swapped(rules: UrlRule[], index: number, target: number): UrlRule[] {
  const next = [...rules];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function actionBadgeClass(action: RuleAction): string {
  return action === 'allow' ? 'badge badge-primary' : 'badge badge-secondary';
}

export function UrlApp() {
  const [policy, setPolicy] = useState<UrlPolicy>(defaultUrlPolicy);
  const [pattern, setPattern] = useState<string>('');
  const [matchType, setMatchType] = useState<MatchType>('exact');
  const [action, setAction] = useState<RuleAction>('deny');
  const [patternError, setPatternError] = useState<boolean>(false);

  useEffect(() => {
    const fetchPolicy = async () => {
      setPolicy(await loadUrlPolicy());
    };
    fetchPolicy();
  }, []);

  const applyPolicy = (next: UrlPolicy) => {
    setPolicy(next);
    saveUrlPolicy(next);
  };

  const addRule = () => {
    if (!isValidPattern(pattern, matchType)) {
      setPatternError(true);
      return;
    }
    setPatternError(false);
    applyPolicy({ ...policy, rules: [...policy.rules, { pattern, matchType, action }] });
    setPattern('');
  };

  return <>
    <div className='flex flex-col w-full gap-3'>
      <h2 className='h2'>URL policy</h2>
      <div className='flex items-center gap-2'>
        <label htmlFor='default-action'>Default policy for URLs matching no rule</label>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_default_policy')()}>
          <select
            id='default-action'
            className='select select-bordered select-sm'
            value={policy.defaultAction}
            onChange={(e) => applyPolicy({ ...policy, defaultAction: e.target.value as RuleAction })}
          >
            {ruleActions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>
      <div className='join w-full'>
        <label className='input input-bordered join-item flex justify-center items-center grow'>
          <input
            type='text'
            id='pattern'
            className={patternError ? 'grow input-error' : 'grow'}
            placeholder='pattern'
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
              setPatternError(false);
            }}
          />
        </label>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_match_type')()}>
          <select
            className='select select-bordered join-item'
            value={matchType}
            onChange={(e) => {
              setMatchType(e.target.value as MatchType);
              setPatternError(false);
            }}
          >
            {matchTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className='tooltip tooltip-top' data-tip={getMessage('tooltip_rule_action')()}>
          <select
            className='select select-bordered join-item'
            value={action}
            onChange={(e) => setAction(e.target.value as RuleAction)}
          >
            {ruleActions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button className='btn btn-primary join-item' onClick={addRule}>add rule</button>
      </div>
      {patternError ? <p className='text-error'>invalid regular expression</p> : null}
      <table className='table'>
        <thead>
          <tr>
            <th>
              <span className='tooltip tooltip-top' data-tip={getMessage('tooltip_rule_order')()}>#</span>
            </th>
            <th>action</th>
            <th>match</th>
            <th>pattern</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {
            policy.rules.map((rule, index) => {
              return <tr key={index}>
                <td>{index + 1}</td>
                <td><span className={actionBadgeClass(rule.action)}>{rule.action}</span></td>
                <td><span className='badge badge-outline'>{rule.matchType}</span></td>
                <td><code>{rule.pattern}</code></td>
                <td className='flex items-center gap-2'>
                  <button
                    className='btn btn-outline btn-xs'
                    disabled={index === 0}
                    onClick={() => applyPolicy({ ...policy, rules: swapped(policy.rules, index, index - 1) })}>
                    <ChevronUpIcon className='w-4 h-4' />
                  </button>
                  <button
                    className='btn btn-outline btn-xs'
                    disabled={index === policy.rules.length - 1}
                    onClick={() => applyPolicy({ ...policy, rules: swapped(policy.rules, index, index + 1) })}>
                    <ChevronDownIcon className='w-4 h-4' />
                  </button>
                  <button
                    className='btn btn-outline btn-xs btn-error'
                    onClick={() => applyPolicy({ ...policy, rules: policy.rules.filter((_, i) => i !== index) })}>
                    <XMarkIcon className='w-4 h-4' />
                  </button>
                </td>
              </tr>;
            })
          }
        </tbody>
      </table>
    </div>
  </>;
}
