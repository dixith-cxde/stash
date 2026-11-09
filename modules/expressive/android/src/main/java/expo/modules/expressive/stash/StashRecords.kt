package expo.modules.expressive.stash

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.io.Serializable

/**
 * Display-ready rows sent from JS (src/features/native/records.ts). The native screens only
 * render them and report intents back through a single `onAction` event.
 */
@OptimizedRecord
data class CardRecord(
  @Field val id: String = "",
  /** link | video | pdf | text | image | file | highlight */
  @Field val kind: String = "link",
  @Field val title: String = "",
  @Field val body: String = "",
  /** Site name or host, shown as the source line and used for the fallback wordmark. */
  @Field val site: String = "",
  /** Seed for the fallback cover colour/shape (the host for links). */
  @Field val seed: String = "",
  /** Relative time or other short metadata ("2h", "Page 6 of 15"). */
  @Field val meta: String = "",
  @Field val cover: String? = null,
  @Field val favicon: String? = null,
  @Field val badge: String? = null,
  @Field val tags: List<String> = emptyList(),
  @Field val unread: Boolean = false,
  @Field val favorite: Boolean = false,
  /** Highlight colour name (yellow, green, blue, pink, purple). */
  @Field val color: String? = null
) : Record

@OptimizedRecord
data class CollectionRecord(
  @Field val key: String = "",
  @Field val title: String = "",
  @Field val subtitle: String = "",
  @Field val shape: String = "cookie9Sided",
  @Field val icon: String = "folder_rounded",
  /** primary | secondary | tertiary */
  @Field val tone: String = "primary",
  @Field val covers: List<String> = emptyList()
) : Record

@OptimizedRecord
data class OptionRecord(
  @Field val key: String = "",
  @Field val label: String = "",
  @Field val icon: String? = null,
  @Field val selectedIcon: String? = null
) : Record

@OptimizedRecord
data class HighlightRecord(
  @Field val id: String = "",
  @Field val text: String = "",
  @Field val note: String? = null,
  @Field val color: String = "yellow",
  @Field val meta: String = ""
) : Record

@OptimizedRecord
data class ChipRecord(
  @Field val key: String = "",
  @Field val label: String = "",
  @Field val selected: Boolean = false
) : Record

/** Every user intent from a native screen: `action` names it, `key`/`value` carry arguments. */
open class StashActionEvent(
  @Field open val action: String = "",
  @Field open val key: String = "",
  @Field open val value: String = ""
) : Record, Serializable
