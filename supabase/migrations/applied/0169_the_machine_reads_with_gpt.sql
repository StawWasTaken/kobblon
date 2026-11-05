begin;

/*
 * New model names, and a vision model that is allowed to be nobody.
 *
 * Both names this started with are gone from Groq. `llama-3.3-70b-versatile`
 * was retired on 16 August 2026 and the Llama 3.2 vision previews went the
 * year before, so every ask has been coming back as an error the worker
 * swallowed - which is why the console kept saying it had looked at twelve
 * things and decided none of them.
 *
 * Staw asked for OpenAI's models, on Groq, where they are free. That is
 * `openai/gpt-oss-120b`: OpenAI's open-weight model, hosted by Groq, same
 * key and same endpoint. The smaller `openai/gpt-oss-20b` is there too if
 * the big one is ever slow.
 *
 * They read; they do not see. GPT-OSS is text only, so `vision_model` is
 * emptied rather than filled with a guess. Empty means no machine looks at
 * pictures and anything with one waits for a person - which is the honest
 * state of Groq's catalogue, and better than a name that answers 404 twelve
 * times a run. The staff console lists what the key can actually see now,
 * so when a vision model appears it is one choice from a menu rather than
 * another migration.
 */
alter table public.ai_settings alter column model set default 'openai/gpt-oss-120b';
alter table public.ai_settings alter column vision_model set default '';

/*
 * Only the names this project wrote down are moved. Anything chosen by hand
 * since is somebody's decision and is left alone.
 */
update public.ai_settings
   set model = 'openai/gpt-oss-120b'
 where model in ('llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192');

update public.ai_settings
   set vision_model = ''
 where vision_model in (
   'llama-3.2-90b-vision-preview',
   'llama-3.2-11b-vision-preview'
 );

commit;
